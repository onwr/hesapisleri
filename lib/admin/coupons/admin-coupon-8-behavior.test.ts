/**
 * Faz 8 — Kupon Yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminCouponActivateSchema,
  adminCouponCreateSchema,
  adminCouponUpdateSchema,
  assertNoForbiddenCouponCreateKeys,
  assertNoForbiddenCouponPatchKeys,
  assertNoForbiddenCouponTargetingKeys,
} from "@/lib/admin/coupons/admin-coupon-schemas";
import {
  detectCouponDiscountIssues,
  detectCouponIssues,
} from "@/lib/admin/coupons/admin-coupon-issue-service";
import {
  buildStructuredCouponActivityWhere,
  matchesStructuredCouponScope,
} from "@/lib/admin/coupons/admin-coupon-activity-scope";
import { buildCouponAuditMetadata } from "@/lib/admin/coupons/admin-coupon-audit-service";
import { assertCouponCodeAllowed } from "@/lib/admin/coupons/admin-coupon-code-utils";
import { parseCouponListFilters } from "@/lib/admin/promotions/promotion-filter-utils";
import { DEFAULT_COUPON_PAGE_SIZE } from "@/lib/admin/promotions/promotion-types";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("coupon create schema", () => {
  it("draft create body geçerli", () => {
    const r = adminCouponCreateSchema.safeParse({
      code: "YAZ2026",
      name: "Yaz Kuponu",
      discountType: "PERCENTAGE",
      discountValue: 15,
      currency: "TRY",
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assert.equal(r.success, true);
  });

  it("client status reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCouponCreateKeys({
        code: "X",
        status: "ACTIVE",
      })
    );
  });

  it("activate flag reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCouponCreateKeys({
        code: "X",
        activate: true,
      })
    );
  });

  it("generic status PATCH reddedilir", () => {
    assert.throws(() => assertNoForbiddenCouponPatchKeys({ status: "ACTIVE" }));
  });

  it("targeting couponId reddedilir", () => {
    assert.throws(() => assertNoForbiddenCouponTargetingKeys({ couponId: "x" }));
  });

  it("yüzde 0–100 dışı issue", () => {
    const issues = detectCouponDiscountIssues("PERCENTAGE", 150);
    assert.ok(issues.some((i) => i.code === "INVALID_DISCOUNT"));
  });

  it("negatif indirim issue", () => {
    const issues = detectCouponDiscountIssues("FIXED_AMOUNT", -100);
    assert.ok(issues.some((i) => i.code === "INVALID_DISCOUNT"));
  });
});

describe("coupon date range", () => {
  it("INVALID_DATE_RANGE", async () => {
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");
    const issues = await detectCouponIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      currency: "TRY",
      startsAt: start,
      expiresAt: end,
      maxUsage: null,
      maxUsagePerCompany: 1,
      stackable: false,
      allowedIntervals: [],
      planIds: [],
    });
    assert.ok(issues.some((i) => i.code === "INVALID_DATE_RANGE"));
  });
});

describe("coupon targeting issues", () => {
  it("ARCHIVED_PLAN_TARGET", async () => {
    const planMap = new Map([
      ["p1", { planStatus: "ARCHIVED", defaultCurrency: "TRY", currency: "TRY" }],
    ]);
    const issues = await detectCouponIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      currency: "TRY",
      startsAt: new Date(),
      expiresAt: null,
      maxUsage: null,
      maxUsagePerCompany: 1,
      stackable: false,
      allowedIntervals: [],
      planIds: ["p1"],
      planById: planMap,
    });
    assert.ok(issues.some((i) => i.code === "ARCHIVED_PLAN_TARGET"));
  });

  it("DUPLICATE_SCOPE", async () => {
    const issues = await detectCouponIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      currency: "TRY",
      startsAt: new Date(),
      expiresAt: null,
      maxUsage: null,
      maxUsagePerCompany: 1,
      stackable: false,
      allowedIntervals: [],
      planIds: ["p1", "p1"],
    });
    assert.ok(issues.some((i) => i.code === "DUPLICATE_SCOPE"));
  });

  it("USAGE_LIMIT_REACHED yalnız finalized sayımına göre", async () => {
    const issues = await detectCouponIssues({
      id: "c1",
      status: "ACTIVE",
      discountType: "PERCENTAGE",
      discountValue: 10,
      currency: "TRY",
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: null,
      maxUsage: 5,
      maxUsagePerCompany: 1,
      stackable: false,
      allowedIntervals: [],
      planIds: [],
      redemptionCountAll: 10,
      redemptionCountFinalized: 5,
    });
    assert.ok(issues.some((i) => i.code === "USAGE_LIMIT_REACHED"));
  });

  it("REDEMPTION_COUNT_MISMATCH", async () => {
    const issues = await detectCouponIssues({
      id: "c1",
      status: "ACTIVE",
      discountType: "PERCENTAGE",
      discountValue: 10,
      currency: "TRY",
      startsAt: new Date(),
      expiresAt: null,
      maxUsage: null,
      maxUsagePerCompany: 1,
      stackable: false,
      allowedIntervals: [],
      planIds: [],
      redemptionCountAll: 2,
      redemptionCountFinalized: 5,
    });
    assert.ok(issues.some((i) => i.code === "REDEMPTION_COUNT_MISMATCH"));
  });
});

describe("coupon code utils", () => {
  it("rezerve kod reddedilir", () => {
    assert.throws(() => assertCouponCodeAllowed("ADMIN"));
  });
});

describe("coupon activity structured scope", () => {
  it("entityType MembershipCoupon eşleşir", () => {
    assert.equal(
      matchesStructuredCouponScope(
        {
          id: "1",
          action: "COUPON_CREATED",
          module: "admin-coupons",
          message: "x",
          entityType: "MembershipCoupon",
          entityId: "cp-1",
          metadata: null,
        },
        "cp-1"
      ),
      true
    );
  });

  it("metadata.couponId eşleşir", () => {
    assert.equal(
      matchesStructuredCouponScope(
        {
          id: "1",
          action: "COUPON_UPDATED",
          module: "admin-coupons",
          message: "x",
          entityType: null,
          entityId: null,
          metadata: { couponId: "cp-2" },
        },
        "cp-2"
      ),
      true
    );
  });

  it("structured where üretir", () => {
    const w = buildStructuredCouponActivityWhere("cp-x");
    assert.ok(w.OR);
  });
});

describe("coupon audit metadata", () => {
  it("couponId metadata içerir", () => {
    const meta = buildCouponAuditMetadata("cp-99", { reason: "test" });
    assert.equal(meta.couponId, "cp-99");
    assert.equal(meta.reason, "test");
  });
});

describe("coupon list filters", () => {
  it("pageSize 25/50/100", () => {
    const f25 = parseCouponListFilters({ pageSize: "25" });
    const f50 = parseCouponListFilters({ pageSize: "50" });
    const fBad = parseCouponListFilters({ pageSize: "30" });
    assert.equal(f25.pageSize, 25);
    assert.equal(f50.pageSize, 50);
    assert.equal(fBad.pageSize, 25);
    assert.equal(DEFAULT_COUPON_PAGE_SIZE, 25);
  });
});

describe("coupon routes and security", () => {
  it("canonical /admin/coupons sayfası var", () => {
    assert.ok(readSrc("app/admin/coupons/page.tsx").includes("listCoupons"));
  });

  it("legacy membership-coupons redirect", () => {
    assert.ok(readSrc("app/admin/membership-coupons/page.tsx").includes("redirect"));
    assert.ok(readSrc("app/admin/membership-coupons/page.tsx").includes("/admin/coupons"));
  });

  it("API canonical coupons route requireSuperAdminApi", () => {
    assert.ok(readSrc("app/api/admin/coupons/route.ts").includes("requireSuperAdminApi"));
  });

  it("activate şeması confirm zorunlu", () => {
    const bad = adminCouponActivateSchema.safeParse({ reason: "x" });
    assert.equal(bad.success, false);
    const ok = adminCouponActivateSchema.safeParse({ reason: "x", confirm: true });
    assert.equal(ok.success, true);
  });

  it("mutation servisi her zaman DRAFT oluşturur", () => {
    const src = readSrc("lib/admin/promotions/coupon-mutation-service.ts");
    assert.ok(src.includes('status: "DRAFT"'));
    assert.ok(!src.includes("parsed.activate"));
  });

  it("cache invalidation checkout pricing", () => {
    const src = readSrc("lib/admin/coupons/admin-coupon-cache.ts");
    assert.ok(src.includes("checkout-plan"));
    assert.ok(src.includes("subscription-plan-change-options"));
    assert.ok(src.includes("revalidateTag"));
  });

  it("issue servisi sahte health score üretmez", () => {
    const src = readSrc("lib/admin/coupons/admin-coupon-issue-service.ts");
    assert.ok(!src.includes("healthScore"));
    assert.ok(src.includes("INVALID_DATE_RANGE"));
    assert.ok(src.includes("USAGE_LIMIT_REACHED"));
  });

  it("preview servisi final fiyat negatif kontrolü", () => {
    const src = readSrc("lib/admin/coupons/admin-coupon-preview-service.ts");
    assert.ok(src.includes("Final fiyat negatif olamaz"));
  });

  it("redemption count yalnız FINALIZED", () => {
    const src = readSrc("lib/admin/coupons/admin-coupon-redemption-utils.ts");
    assert.ok(src.includes('status: "FINALIZED"'));
  });

  it("concurrent redemption limit kontrolü", () => {
    const src = readSrc("lib/billing/discount-reservation-service.ts");
    assert.ok(src.includes("maxUsage"));
    assert.ok(src.includes("maxUsagePerCompany"));
    assert.ok(src.includes("Kupon kullanım limiti doldu"));
  });
});

describe("coupon update schema", () => {
  it("boş PATCH reddedilir", () => {
    const r = adminCouponUpdateSchema.safeParse({});
    assert.equal(r.success, false);
  });
});
