/**
 * Faz 12 — Partner başvuru davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  adminPartnerApplicationApproveSchema,
  adminPartnerApplicationRejectSchema,
  assertApplicationPending,
  assertNoForbiddenApplicationDecisionKeys,
  assertValidStatusTransition,
  detectApplicationIssues,
  maskIban,
  parseApplicationListFilters,
  redactApplicationRow,
} from "@/lib/admin/partner-applications";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("application list filters", () => {
  it("pagination 25/50/100", () => {
    assert.equal(parseApplicationListFilters({ pageSize: "50" }).pageSize, 50);
    assert.equal(parseApplicationListFilters({ pageSize: "99" }).pageSize, 25);
  });

  it("status ve tarih filtresi parse", () => {
    const f = parseApplicationListFilters({
      status: "PENDING",
      dateFrom: "2026-01-01",
      q: "test@mail.com",
    });
    assert.equal(f.status, "PENDING");
    assert.equal(f.dateFrom, "2026-01-01");
    assert.equal(f.q, "test@mail.com");
  });
});

describe("application issues", () => {
  it("EMAIL_MISSING ve PHONE_MISSING", () => {
    const issues = detectApplicationIssues({
      application: {
        id: "a1",
        fullName: "X",
        email: "",
        phone: null,
        status: "PENDING",
      },
      matchedUserId: null,
    });
    assert.ok(issues.some((i) => i.code === "EMAIL_MISSING"));
    assert.ok(issues.some((i) => i.code === "PHONE_MISSING"));
  });

  it("APPLICATION_ALREADY_PROCESSED", () => {
    const issues = detectApplicationIssues({
      application: {
        id: "a1",
        fullName: "X",
        email: "a@b.com",
        phone: "1",
        status: "APPROVED",
      },
    });
    assert.ok(issues.some((i) => i.code === "APPLICATION_ALREADY_PROCESSED"));
  });

  it("model desteklemeyen COMPANY issue yok", () => {
    const src = readSrc("lib/admin/partner-applications/admin-partner-application-issue-service.ts");
    assert.ok(!src.includes("COMPANY_INFO_MISSING"));
    assert.ok(!src.includes("DUPLICATE_COMPANY"));
    assert.ok(!src.includes("PAYMENT_INFO_MISSING"));
  });
});

describe("approve/reject guards", () => {
  it("pending assert", () => {
    assert.equal(assertApplicationPending("PENDING").ok, true);
    assert.equal(assertApplicationPending("APPROVED").ok, false);
  });

  it("INVALID_STATUS_TRANSITION", () => {
    const r = assertValidStatusTransition("APPROVED", "REJECTED");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issues[0]?.code, "INVALID_STATUS_TRANSITION");
  });

  it("approve confirm zorunlu", () => {
    assert.equal(
      adminPartnerApplicationApproveSchema.safeParse({ reason: "ok" }).success,
      false
    );
    assert.equal(
      adminPartnerApplicationApproveSchema.safeParse({ reason: "ok", confirm: true }).success,
      true
    );
  });

  it("reject confirm zorunlu", () => {
    assert.equal(
      adminPartnerApplicationRejectSchema.safeParse({ reason: "no" }).success,
      false
    );
  });

  it("body applicationId reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenApplicationDecisionKeys({ applicationId: "x", reason: "y", confirm: true })
    );
  });

  it("generic status PATCH reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenApplicationDecisionKeys({ status: "APPROVED", reason: "x" })
    );
  });
});

describe("approve mutation contract", () => {
  it("PASSIVE profil oluşturur", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes('status: "PASSIVE"'));
  });

  it("transaction içinde unique kontrol", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes("$transaction"));
    assert.ok(src.includes("tx.partnerProfile.findFirst({ where: { referralCode } })"));
    assert.ok(src.includes("EXISTING_PARTNER_PROFILE"));
  });

  it("ikinci approve engeli", () => {
    assert.equal(assertApplicationPending("APPROVED").ok, false);
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes("assertApplicationPending"));
  });

  it("reject PartnerProfile oluşturmaz", () => {
    const rejectBlock = readSrc("lib/admin/partner-applications/application-mutation-service.ts").slice(
      readSrc("lib/admin/partner-applications/application-mutation-service.ts").indexOf(
        "export async function rejectPartnerApplicationAdmin"
      )
    );
    assert.ok(!rejectBlock.includes("partnerProfile.create"));
  });

  it("approve payout/earning oluşturmaz", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(!src.includes("partnerEarning.create"));
    assert.ok(!src.includes("partnerPayout.create"));
  });
});

describe("structured audit", () => {
  it("entityType PartnerApplication", () => {
    const src = readSrc("lib/admin/partner-applications/admin-partner-application-audit-service.ts");
    assert.ok(src.includes('entityType: "PartnerApplication"'));
    assert.ok(src.includes("applicationId"));
    assert.ok(src.includes("partnerId"));
    assert.ok(src.includes("admin-partner-applications"));
  });

  it("mutation audit aksiyonları", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes("PARTNER_APPLICATION_REJECTED"));
    assert.ok(src.includes("PARTNER_CREATED_FROM_APPLICATION"));
  });
});

describe("cache invalidation", () => {
  it("application ve partner cache", () => {
    const src = readSrc("lib/admin/partner-applications/admin-partner-application-cache.ts");
    assert.ok(src.includes("admin-partner-applications"));
    assert.ok(src.includes("admin-partners"));
    assert.ok(src.includes("admin-overview"));
  });
});

describe("privacy", () => {
  it("IBAN maskeli", () => {
    assert.equal(maskIban("TR330006100519786457841326"), "TR33****1326");
  });

  it("secret redaction", () => {
    const out = redactApplicationRow({ secret: "x", apiKey: "y" }) as Record<string, unknown>;
    assert.equal(out.secret, "[redacted]");
  });
});

describe("auth matrix", () => {
  const routes = [
    "app/api/admin/partner-applications/route.ts",
    "app/api/admin/partner-applications/[id]/route.ts",
    "app/api/admin/partner-applications/[id]/approve/route.ts",
    "app/api/admin/partner-applications/[id]/reject/route.ts",
  ];

  for (const route of routes) {
    it(`${route} requireSuperAdminApi`, () => {
      assert.ok(readSrc(route).includes("requireSuperAdminApi"));
    });
  }

  it("tenant OWNER reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "OWNER", status: "ACTIVE", email: "o@t.com" }),
      false
    );
  });

  it("legacy PATCH 405", () => {
    const src = readSrc("app/api/admin/partners/applications/[id]/route.ts");
    assert.ok(src.includes("405"));
    assert.ok(src.includes("approve"));
  });
});

describe("note isolation partner scope", () => {
  it("noteId route partnerId ile birlikte", () => {
    const approve = readSrc("app/api/admin/partner-applications/[id]/approve/route.ts");
    assert.ok(approve.includes("approvePartnerApplicationAdmin(id"));
    assert.ok(!approve.includes("body.applicationId"));
  });
});
