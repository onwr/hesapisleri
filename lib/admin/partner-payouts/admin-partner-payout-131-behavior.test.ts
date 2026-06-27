/**
 * Faz 13.1 — Payout UI ve ödeme referansı
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  adminPartnerPayoutCreateSchema,
  adminPartnerPayoutMarkPaidSchema,
  assertNoForbiddenPayoutCreateKeys,
  assertNoForbiddenPayoutDecisionKeys,
  validateEarningsForCreate,
} from "@/lib/admin/partner-payouts";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("create modal API contract", () => {
  it("create modal doğru API kullanır", () => {
    const src = readSrc("components/admin/admin-partner-payout-create-modal.tsx");
    assert.ok(src.includes('fetch("/api/admin/partner-payouts"'));
    assert.ok(src.includes("method: \"POST\""));
    assert.ok(src.includes("/api/admin/partner-payouts/eligible-earnings"));
    assert.ok(!src.includes("total:"));
  });

  it("create reason ve confirm zorunlu", () => {
    assert.equal(
      adminPartnerPayoutCreateSchema.safeParse({
        earningIds: ["e1"],
        paymentMethod: "MANUAL",
      }).success,
      false
    );
    assert.equal(
      adminPartnerPayoutCreateSchema.safeParse({
        earningIds: ["e1"],
        paymentMethod: "MANUAL",
        reason: "test",
        confirm: true,
      }).success,
      true
    );
  });

  it("client total reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutCreateKeys({
        earningIds: ["e1"],
        total: 100,
        paymentMethod: "MANUAL",
        reason: "x",
        confirm: true,
      })
    );
  });

  it("create paymentReference reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutCreateKeys({
        earningIds: ["e1"],
        paymentReference: "REF",
        paymentMethod: "MANUAL",
        reason: "x",
        confirm: true,
      })
    );
  });
});

describe("earning validation", () => {
  const base = {
    id: "e1",
    partnerId: "p1",
    amount: new Prisma.Decimal(10),
    currency: "TRY",
    status: "APPROVED" as const,
    payoutId: null,
    createdAt: new Date(),
  };

  it("farklı partner earning reddi", () => {
    const r = validateEarningsForCreate([base, { ...base, id: "e2", partnerId: "p2" }]);
    assert.equal(r.ok, false);
  });

  it("farklı currency reddi", () => {
    const r = validateEarningsForCreate([base, { ...base, id: "e2", currency: "USD" }]);
    assert.equal(r.ok, false);
  });
});

describe("mark-paid reference", () => {
  it("paymentReference zorunlu", () => {
    assert.equal(
      adminPartnerPayoutMarkPaidSchema.safeParse({ reason: "ok", confirm: true }).success,
      false
    );
  });

  it("paidByUserId body reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutDecisionKeys({
        paidByUserId: "u1",
        reason: "x",
        confirm: true,
        paymentReference: "REF",
      })
    );
  });

  it("note içine ref yazılmaz", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(!src.includes("formatPaymentNote"));
    assert.ok(!src.includes("ref:"));
    assert.ok(src.includes("paymentReference"));
    assert.ok(src.includes("paidByUserId: actorUserId"));
  });

  it("duplicate reference kontrolü", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("assertPaymentReferenceUnique"));
    assert.ok(src.includes("DUPLICATE_PAYMENT_REFERENCE"));
  });

  it("paid idempotency", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes('payout.status === "PAID"'));
    assert.ok(src.includes('where: { id: payoutId, status: "PENDING" }'));
  });
});

describe("transaction safety", () => {
  it("concurrent earning assignment engeli", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("payoutId: null"));
    assert.ok(src.includes("linked.count !== uniqueIds.length"));
    assert.ok(src.includes("$transaction"));
  });

  it("issue service note ref kullanmaz", () => {
    const src = readSrc("lib/admin/partner-payouts/admin-partner-payout-issue-service.ts");
    assert.ok(src.includes("paymentReference"));
    assert.ok(!src.includes("extractPaymentReference"));
  });
});

describe("schema migration", () => {
  it("paymentReference ve paidByUserId alanları", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("paymentReference String?"));
    assert.ok(schema.includes("paidByUserId"));
    assert.ok(schema.includes("PartnerPayoutsPaidBy"));
    assert.ok(schema.includes("@@unique([partnerId, paymentReference])"));
  });
});

describe("auth and cache", () => {
  it("eligible-earnings requireSuperAdminApi", () => {
    const src = readRoute(["admin", "partner-payouts", "eligible-earnings"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("audit cache invalidation", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("invalidateAdminPartnerPayoutCaches"));
    assert.ok(src.includes("PARTNER_PAYOUT_CREATED"));
    assert.ok(src.includes("PARTNER_PAYOUT_PAID"));
  });
});
