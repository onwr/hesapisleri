/**
 * Faz 11 — Partner yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminPartnerCreateSchema,
  adminPartnerLifecycleSchema,
  assertNoForbiddenPartnerCreateKeys,
  assertNoForbiddenPartnerPatchKeys,
  assertPartnerActivationAllowed,
  buildStructuredPartnerActivityWhere,
  detectPartnerIssues,
  matchesStructuredPartnerScope,
  parsePartnerListFilters,
  redactPartnerActivityRow,
} from "@/lib/admin/partners";
import { AdminPartnerServiceError } from "@/lib/admin/partners/admin-partner-errors";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("partner create schema", () => {
  it("draft/passive create geçerli", () => {
    const r = adminPartnerCreateSchema.safeParse({
      fullName: "Test Partner",
      email: "p@example.com",
      commissionRate: 10,
    });
    assert.equal(r.success, true);
  });

  it("client status reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerCreateKeys({ fullName: "X", status: "ACTIVE" }));
  });

  it("generic status PATCH reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerPatchKeys({ status: "ACTIVE" }));
  });
});

describe("partner lifecycle", () => {
  it("activate confirm zorunlu", () => {
    assert.equal(adminPartnerLifecycleSchema.safeParse({ reason: "x" }).success, false);
    assert.equal(
      adminPartnerLifecycleSchema.safeParse({ reason: "x", confirm: true }).success,
      true
    );
  });

  it("aktivasyon commission kuralı", () => {
    const bad = assertPartnerActivationAllowed({
      partner: {
        id: "p1",
        status: "PASSIVE",
        email: "a@b.com",
        phone: null,
        referralCode: "CODE1",
        commissionRate: { toString: () => "0" } as never,
        iban: null,
        payoutMethod: null,
        accountHolderName: null,
      },
    });
    assert.equal(bad.ok, false);
  });

  it("archive servisi geçmişi silmez", () => {
    const src = readSrc("lib/admin/partners/partner-mutation-service.ts");
    assert.ok(src.includes('status: "ARCHIVED"'));
    assert.ok(!src.includes(".delete("));
    assert.ok(!src.includes("partnerConversion.delete"));
    assert.ok(!src.includes("partnerEarning.delete"));
  });
});

describe("partner issues", () => {
  it("MISSING_CONTACT", () => {
    const issues = detectPartnerIssues({
      partner: {
        id: "p1",
        status: "PASSIVE",
        email: "",
        phone: null,
        referralCode: "X",
        commissionRate: { toString: () => "10" } as never,
        iban: null,
        payoutMethod: null,
        accountHolderName: null,
      },
    });
    assert.ok(issues.some((i) => i.code === "MISSING_CONTACT"));
  });

  it("ARCHIVED_WITH_ACTIVE_COMPANIES", () => {
    const issues = detectPartnerIssues({
      partner: {
        id: "p1",
        status: "ARCHIVED",
        email: "a@b.com",
        phone: "1",
        referralCode: "X",
        commissionRate: { toString: () => "10" } as never,
        iban: "TR",
        payoutMethod: "IBAN",
        accountHolderName: null,
      },
      activeCompanyCount: 2,
    });
    assert.ok(issues.some((i) => i.code === "ARCHIVED_WITH_ACTIVE_COMPANIES"));
  });
});

describe("partner activity scope", () => {
  it("structured scope PartnerProfile", () => {
    assert.equal(
      matchesStructuredPartnerScope(
        {
          id: "1",
          action: "PARTNER_CREATED",
          module: "admin-partners",
          message: "x",
          entityType: "PartnerProfile",
          entityId: "p-1",
          metadata: null,
        },
        "p-1"
      ),
      true
    );
  });

  it("metadata partnerId", () => {
    const where = buildStructuredPartnerActivityWhere("p-x");
    assert.ok(where.OR);
  });
});

describe("partner list filters", () => {
  it("pageSize 25/50/100", () => {
    assert.equal(parsePartnerListFilters({ pageSize: "50" }).pageSize, 50);
    assert.equal(parsePartnerListFilters({ pageSize: "99" }).pageSize, 25);
  });
});

describe("partner security", () => {
  it("tenant admin reddi", () => {
    assert.ok(readSrc("app/api/admin/partners/route.ts").includes("requireSuperAdminApi"));
    assert.ok(readSrc("app/api/admin/partners/[id]/activate/route.ts").includes("requireSuperAdminApi"));
  });

  it("sensitive redaction", () => {
    const out = redactPartnerActivityRow({
      ok: true,
      secret: "hidden",
      nested: { apiKey: "x" },
    }) as Record<string, unknown>;
    assert.equal(out.secret, "[redacted]");
    assert.equal((out.nested as Record<string, unknown>).apiKey, "[redacted]");
  });

  it("cache invalidation", () => {
    const src = readSrc("lib/admin/partners/admin-partner-cache.ts");
    assert.ok(src.includes("admin-partners"));
    assert.ok(src.includes("admin-overview"));
  });

  it("create PASSIVE başlar", () => {
    const src = readSrc("lib/admin/partners/partner-mutation-service.ts");
    assert.ok(src.includes('status: "PASSIVE"'));
  });

  it("lifecycle endpointleri", () => {
    const src = readSrc("components/admin/admin-partner-actions.tsx");
    assert.ok(src.includes('run("activate")'));
    assert.ok(src.includes('run("suspend")'));
    assert.ok(src.includes('run("archive")'));
    assert.ok(src.includes("/api/admin/partners/${partnerId}/${action}"));
  });
});

describe("commission currency isolation", () => {
  it("totalsByCurrency ayrı", () => {
    const src = readSrc("lib/admin/partners/partner-query-service.ts");
    assert.ok(src.includes("totalsByCurrency"));
    assert.ok(src.includes("currency: e.currency"));
  });
});
