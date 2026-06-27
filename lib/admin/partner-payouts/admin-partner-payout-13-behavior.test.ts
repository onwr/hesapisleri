/**
 * Faz 13 — Partner payout davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Prisma } from "@prisma/client";
import {
  adminPartnerPayoutApproveSchema,
  adminPartnerPayoutCreateSchema,
  adminPartnerPayoutMarkPaidSchema,
  assertNoForbiddenPayoutDecisionKeys,
  assertValidPayoutStatusTransition,
  detectPayoutIssues,
  maskIban,
  maskPaymentReference,
  matchesStructuredPayoutScope,
  parsePayoutListFilters,
  redactPayoutRow,
  validateEarningsForCreate,
} from "@/lib/admin/partner-payouts";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("payout list filters", () => {
  it("pagination 25/50/100", () => {
    assert.equal(parsePayoutListFilters({ pageSize: "50" }).pageSize, 50);
    assert.equal(parsePayoutListFilters({ pageSize: "99" }).pageSize, 25);
  });

  it("status currency ve issue filtresi", () => {
    const f = parsePayoutListFilters({
      status: "PENDING",
      currency: "TRY",
      hasIssue: "1",
    });
    assert.equal(f.status, "PENDING");
    assert.equal(f.currency, "TRY");
    assert.equal(f.hasIssue, true);
  });
});

describe("payout create validation", () => {
  const baseEarning = {
    id: "e1",
    partnerId: "p1",
    amount: new Prisma.Decimal(100),
    currency: "TRY",
    status: "APPROVED" as const,
    payoutId: null,
    createdAt: new Date("2026-06-01"),
  };

  it("uygun earnings ile create validation", () => {
    const r = validateEarningsForCreate([baseEarning]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.partnerId, "p1");
      assert.equal(r.currency, "TRY");
      assert.equal(r.total, 100);
    }
  });

  it("duplicate earning engeli", () => {
    const r = validateEarningsForCreate([{ ...baseEarning, payoutId: "pay1" }]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issues[0]?.code, "EARNING_ALREADY_ASSIGNED");
  });

  it("currency isolation", () => {
    const r = validateEarningsForCreate([
      baseEarning,
      { ...baseEarning, id: "e2", currency: "USD" },
    ]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issues[0]?.code, "CURRENCY_MISMATCH");
  });

  it("partner mismatch", () => {
    const r = validateEarningsForCreate([
      baseEarning,
      { ...baseEarning, id: "e2", partnerId: "p2" },
    ]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.issues.some((i) => i.code === "PARTNER_MISMATCH"));
  });

  it("server-side total hesaplanır", () => {
    const r = validateEarningsForCreate([
      baseEarning,
      { ...baseEarning, id: "e2", amount: new Prisma.Decimal(50) },
    ]);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.total, 150);
  });

  it("create schema client total reddeder", () => {
    assert.throws(() =>
      assertNoForbiddenPayoutDecisionKeys({ total: 100, earningIds: ["e1"], paymentMethod: "MANUAL" })
    );
  });
});

describe("payout lifecycle", () => {
  it("approve DRAFT -> PENDING", () => {
    assert.equal(assertValidPayoutStatusTransition("DRAFT", "PENDING").ok, true);
  });

  it("invalid transition", () => {
    const r = assertValidPayoutStatusTransition("PAID", "PENDING");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.issues[0]?.code, "INVALID_STATUS_TRANSITION");
  });

  it("approve confirm zorunlu", () => {
    assert.equal(adminPartnerPayoutApproveSchema.safeParse({ reason: "ok" }).success, false);
    assert.equal(
      adminPartnerPayoutApproveSchema.safeParse({ reason: "ok", confirm: true }).success,
      true
    );
  });

  it("paid reference zorunlu", () => {
    assert.equal(
      adminPartnerPayoutMarkPaidSchema.safeParse({ reason: "ok", confirm: true }).success,
      false
    );
    assert.equal(
      adminPartnerPayoutMarkPaidSchema.safeParse({
        reason: "ok",
        confirm: true,
        paymentReference: "REF-123",
      }).success,
      true
    );
  });

  it("create DRAFT başlar", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes('status: "DRAFT"'));
    assert.ok(!src.includes("markPaid"));
  });

  it("transaction içinde oluşturma", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes("$transaction"));
    assert.ok(src.includes("PARTNER_PAYOUT_CREATED"));
  });

  it("paid idempotency", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes('payout.status === "PAID"'));
  });

  it("paid earning status transaction", () => {
    const src = readSrc("lib/admin/partner-payouts/payout-mutation-service.ts");
    assert.ok(src.includes('status: "PAID"'));
    assert.ok(src.includes("partnerEarning.updateMany"));
  });

  it("generic status PATCH reddi", () => {
    assert.throws(() => assertNoForbiddenPayoutDecisionKeys({ status: "PAID", reason: "x" }));
  });
});

describe("payout issues", () => {
  it("archive partner issue", () => {
    const issues = detectPayoutIssues({
      payout: {
        id: "pay1",
        partnerId: "p1",
        amount: new Prisma.Decimal(100),
        currency: "TRY",
        status: "DRAFT",
        paymentMethod: "IBAN",
        note: null,
        paymentReference: null,
      },
      partner: {
        id: "p1",
        status: "ARCHIVED",
        iban: null,
        payoutMethod: null,
        accountHolderName: null,
      },
      earnings: [
        {
          id: "e1",
          partnerId: "p1",
          amount: new Prisma.Decimal(100),
          currency: "TRY",
          status: "APPROVED",
          payoutId: "pay1",
        },
      ],
    });
    assert.ok(issues.some((i) => i.code === "ARCHIVED_PARTNER"));
  });

  it("TOTAL_MISMATCH", () => {
    const issues = detectPayoutIssues({
      payout: {
        id: "pay1",
        partnerId: "p1",
        amount: new Prisma.Decimal(200),
        currency: "TRY",
        status: "DRAFT",
        paymentMethod: "MANUAL",
        note: null,
        paymentReference: null,
      },
      partner: {
        id: "p1",
        status: "ACTIVE",
        iban: "TR123",
        payoutMethod: "IBAN",
        accountHolderName: "Test",
      },
      earnings: [
        {
          id: "e1",
          partnerId: "p1",
          amount: new Prisma.Decimal(100),
          currency: "TRY",
          status: "APPROVED",
          payoutId: "pay1",
        },
      ],
    });
    assert.ok(issues.some((i) => i.code === "TOTAL_MISMATCH"));
  });

  it("model desteklemeyen issue yok", () => {
    const src = readSrc("lib/admin/partner-payouts/admin-partner-payout-issue-service.ts");
    assert.ok(!src.includes("DUPLICATE_PAYOUT_PERIOD"));
    assert.ok(!src.includes("PROCESSING"));
  });
});

describe("privacy and activity scope", () => {
  it("IBAN mask", () => {
    assert.equal(maskIban("TR330006100519786457841326"), "TR33****1326");
  });

  it("banka referans mask", () => {
    assert.equal(maskPaymentReference("REF-12345678"), "RE****78");
  });

  it("recursive redaction", () => {
    const out = redactPayoutRow({ secret: "x", iban: "TR123" }) as Record<string, unknown>;
    assert.equal(out.secret, "[redacted]");
  });

  it("structured activity scope", () => {
    assert.equal(
      matchesStructuredPayoutScope(
        {
          id: "1",
          action: "PARTNER_PAYOUT_CREATED",
          module: "admin-partner-payouts",
          message: "x",
          entityType: "PartnerPayout",
          entityId: "pay1",
          metadata: null,
        },
        "pay1"
      ),
      true
    );
    assert.equal(
      matchesStructuredPayoutScope(
        {
          id: "2",
          action: "X",
          module: "admin-partner-payouts",
          message: "y",
          entityType: null,
          entityId: null,
          metadata: { payoutId: "pay1" },
        },
        "pay1"
      ),
      true
    );
  });
});

describe("create schema", () => {
  it("earningIds zorunlu", () => {
    assert.equal(
      adminPartnerPayoutCreateSchema.safeParse({ paymentMethod: "MANUAL", reason: "x", confirm: true }).success,
      false
    );
  });
});
