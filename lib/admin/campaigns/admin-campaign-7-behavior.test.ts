/**
 * Faz 7 — Kampanya Yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminCampaignCreateSchema,
  adminCampaignUpdateSchema,
  adminCampaignActivateSchema,
  assertNoForbiddenCampaignCreateKeys,
  assertNoForbiddenCampaignPatchKeys,
} from "@/lib/admin/campaigns/admin-campaign-schemas";
import {
  detectCampaignIssues,
  detectDiscountIssues,
} from "@/lib/admin/campaigns/admin-campaign-issue-service";
import {
  buildStructuredCampaignActivityWhere,
  matchesStructuredCampaignScope,
} from "@/lib/admin/campaigns/admin-campaign-activity-scope";
import { buildCampaignAuditMetadata } from "@/lib/admin/campaigns/admin-campaign-audit-service";
import { parseCampaignListFilters } from "@/lib/admin/promotions/promotion-filter-utils";
import { DEFAULT_CAMPAIGN_PAGE_SIZE } from "@/lib/admin/promotions/promotion-types";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("campaign create schema", () => {
  it("draft create body geçerli", () => {
    const r = adminCampaignCreateSchema.safeParse({
      name: "Yaz İndirimi",
      discountType: "PERCENTAGE",
      discountValue: 15,
      currency: "TRY",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assert.equal(r.success, true);
  });

  it("client status reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCampaignCreateKeys({
        name: "X",
        status: "ACTIVE",
      })
    );
  });

  it("publish reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCampaignCreateKeys({
        name: "X",
        publish: true,
      })
    );
  });

  it("generic status PATCH reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCampaignPatchKeys({ status: "ACTIVE" })
    );
  });

  it("yüzde 0–100 dışı issue", () => {
    const issues = detectDiscountIssues("PERCENTAGE", 150);
    assert.ok(issues.some((i) => i.code === "DISCOUNT_INVALID"));
  });

  it("negatif indirim issue", () => {
    const issues = detectDiscountIssues("FIXED_AMOUNT", -100);
    assert.ok(issues.some((i) => i.code === "DISCOUNT_INVALID"));
  });
});

describe("campaign date range", () => {
  it("INVALID_DATE_RANGE", async () => {
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-06-01T00:00:00Z");
    const issues = await detectCampaignIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      overridePriceMinor: null,
      currency: "TRY",
      startsAt: start,
      endsAt: end,
      maxRedemptions: null,
      autoApply: false,
      stackable: false,
      priority: 100,
      scopes: [],
    });
    assert.ok(issues.some((i) => i.code === "INVALID_DATE_RANGE"));
  });
});

describe("campaign targeting issues", () => {
  it("ARCHIVED_PLAN_TARGET", async () => {
    const planMap = new Map([
      ["p1", { planStatus: "ARCHIVED", defaultCurrency: "TRY", currency: "TRY" }],
    ]);
    const issues = await detectCampaignIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      overridePriceMinor: null,
      currency: "TRY",
      startsAt: new Date(),
      endsAt: null,
      maxRedemptions: null,
      autoApply: false,
      stackable: false,
      priority: 100,
      scopes: [{ planId: "p1", billingInterval: "MONTHLY", companyId: null, partnerId: null }],
      planById: planMap,
    });
    assert.ok(issues.some((i) => i.code === "ARCHIVED_PLAN_TARGET"));
  });

  it("DUPLICATE_TARGET", async () => {
    const scope = {
      planId: "p1",
      billingInterval: "MONTHLY" as const,
      companyId: null,
      partnerId: null,
    };
    const issues = await detectCampaignIssues({
      id: "c1",
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      overridePriceMinor: null,
      currency: "TRY",
      startsAt: new Date(),
      endsAt: null,
      maxRedemptions: null,
      autoApply: false,
      stackable: false,
      priority: 100,
      scopes: [scope, scope],
    });
    assert.ok(issues.some((i) => i.code === "DUPLICATE_TARGET"));
  });
});

describe("campaign activity structured scope", () => {
  it("entityType MembershipCampaign eşleşir", () => {
    assert.equal(
      matchesStructuredCampaignScope(
        {
          id: "1",
          action: "CAMPAIGN_CREATED",
          module: "admin-campaigns",
          message: "x",
          entityType: "MembershipCampaign",
          entityId: "camp-1",
          metadata: null,
        },
        "camp-1"
      ),
      true
    );
  });

  it("metadata.campaignId eşleşir", () => {
    assert.equal(
      matchesStructuredCampaignScope(
        {
          id: "1",
          action: "CAMPAIGN_UPDATED",
          module: "admin-campaigns",
          message: "x",
          entityType: null,
          entityId: null,
          metadata: { campaignId: "camp-2" },
        },
        "camp-2"
      ),
      true
    );
  });

  it("structured where üretir", () => {
    const w = buildStructuredCampaignActivityWhere("camp-x");
    assert.ok(w.OR);
  });
});

describe("campaign audit metadata", () => {
  it("campaignId metadata içerir", () => {
    const meta = buildCampaignAuditMetadata("c-99", { reason: "test" });
    assert.equal(meta.campaignId, "c-99");
    assert.equal(meta.reason, "test");
  });
});

describe("campaign list filters", () => {
  it("pageSize 25/50/100", () => {
    const f25 = parseCampaignListFilters({ pageSize: "25" });
    const f50 = parseCampaignListFilters({ pageSize: "50" });
    const fBad = parseCampaignListFilters({ pageSize: "30" });
    assert.equal(f25.pageSize, 25);
    assert.equal(f50.pageSize, 50);
    assert.equal(fBad.pageSize, 25);
    assert.equal(DEFAULT_CAMPAIGN_PAGE_SIZE, 25);
  });
});

describe("campaign routes and security", () => {
  it("canonical /admin/campaigns sayfası var", () => {
    assert.ok(readSrc("app/admin/campaigns/page.tsx").includes("listCampaigns"));
  });

  it("legacy membership-campaigns redirect", () => {
    assert.ok(readSrc("app/admin/membership-campaigns/page.tsx").includes("redirect"));
    assert.ok(readSrc("app/admin/membership-campaigns/page.tsx").includes("/admin/campaigns"));
  });

  it("API canonical campaigns route requireSuperAdminApi", () => {
    assert.ok(readSrc("app/api/admin/campaigns/route.ts").includes("requireSuperAdminApi"));
  });

  it("activate şeması confirm zorunlu", () => {
    const bad = adminCampaignActivateSchema.safeParse({ reason: "x" });
    assert.equal(bad.success, false);
    const ok = adminCampaignActivateSchema.safeParse({ reason: "x", confirm: true });
    assert.equal(ok.success, true);
  });

  it("mutation servisi her zaman DRAFT oluşturur", () => {
    const src = readSrc("lib/admin/promotions/campaign-mutation-service.ts");
    assert.ok(src.includes('status: "DRAFT"'));
    assert.ok(!src.includes("parsed.publish"));
  });

  it("cache invalidation checkout pricing", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-cache.ts");
    assert.ok(src.includes("checkout-plan"));
    assert.ok(src.includes("subscription-plan-change-options"));
    assert.ok(src.includes("revalidateTag"));
  });

  it("issue servisi sahte health score üretmez", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-issue-service.ts");
    assert.ok(!src.includes("healthScore"));
    assert.ok(src.includes("INVALID_DATE_RANGE"));
    assert.ok(src.includes("CONFLICTING_CAMPAIGN"));
  });

  it("preview servisi final fiyat negatif kontrolü", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-preview-service.ts");
    assert.ok(src.includes("Final fiyat negatif olamaz"));
    assert.ok(src.includes("Math.max(0"));
  });
});

describe("campaign update schema", () => {
  it("boş PATCH reddedilir", () => {
    const r = adminCampaignUpdateSchema.safeParse({});
    assert.equal(r.success, false);
  });
});
