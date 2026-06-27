/**
 * Faz 7.1 — kampanya son rötuşlar
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminCampaignTargetingSchema,
  assertNoForbiddenCampaignTargetingKeys,
} from "@/lib/admin/campaigns/admin-campaign-schemas";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const baseTargeting = {
  scopes: [],
  reason: "Hedefleme güncellemesi",
  currency: "TRY" as const,
  minimumAmountMinor: null,
  maxRedemptions: null,
  maxRedemptionsPerCompany: null,
  newCustomersOnly: false,
  existingCustomersAllowed: true,
  firstPaymentOnly: false,
  renewalAllowed: true,
  autoApply: false,
  stackable: false,
  priority: 100,
};

describe("targeting schema", () => {
  it("geçerli targeting body", () => {
    const r = adminCampaignTargetingSchema.safeParse(baseTargeting);
    assert.equal(r.success, true);
  });

  it("reason zorunlu", () => {
    const r = adminCampaignTargetingSchema.safeParse({ ...baseTargeting, reason: "" });
    assert.equal(r.success, false);
  });

  it("campaignId body reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCampaignTargetingKeys({ campaignId: "evil", reason: "x" })
    );
    try {
      assertNoForbiddenCampaignTargetingKeys({ campaignId: "evil" });
    } catch (e) {
      assert.ok(e instanceof PromotionError);
      assert.match((e as PromotionError).message, /campaignId/);
    }
  });

  it("status body reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenCampaignTargetingKeys({ status: "ACTIVE" })
    );
  });
});

describe("targeting mutation service", () => {
  it("updateCampaignTargeting campaignId reddeder", () => {
    const src = readSrc("lib/admin/promotions/campaign-mutation-service.ts");
    assert.ok(src.includes("assertNoForbiddenCampaignTargetingKeys"));
    assert.ok(src.includes("CAMPAIGN_TARGETING_UPDATED"));
    assert.ok(src.includes("invalidateAdminCampaignCaches"));
  });

  it("archived plan assertScopesValid reddeder", () => {
    const src = readSrc("lib/admin/promotions/campaign-mutation-service.ts");
    assert.ok(src.includes("Arşivlenmiş plan hedeflenemez"));
    assert.ok(src.includes("Aynı hedef kapsam"));
  });
});

describe("targeting UI", () => {
  it("AdminCampaignTargetingEditor PUT targeting API kullanır", () => {
    const src = readSrc("components/admin/admin-campaign-targeting-editor.tsx");
    assert.ok(src.includes("/api/admin/campaigns/"));
    assert.ok(src.includes("/targeting"));
    assert.ok(src.includes("method: \"PUT\""));
    assert.ok(src.includes("reason.trim()"));
    assert.ok(src.includes("disabled={saving}"));
    assert.ok(src.includes("loadTargeting"));
  });

  it("detail tab targeting editor bağlı", () => {
    const src = readSrc("components/admin/admin-campaign-detail-tabs.tsx");
    assert.ok(src.includes("AdminCampaignTargetingEditor"));
    assert.ok(src.includes('tab === "targeting"'));
  });
});

describe("legacy route wrappers", () => {
  it("pause legacy re-export canonical", () => {
    const src = readSrc("app/api/admin/membership-campaigns/[id]/pause/route.ts");
    assert.ok(src.includes("campaigns/[id]/pause/route"));
    assert.ok(!src.includes("pauseCampaign"));
  });

  it("publish legacy re-export canonical", () => {
    const src = readSrc("app/api/admin/membership-campaigns/[id]/publish/route.ts");
    assert.ok(src.includes("campaigns/[id]/publish/route"));
    assert.ok(!src.includes("publishCampaign"));
  });

  it("canonical pause publishCampaign/pauseCampaign servisleri", () => {
    assert.ok(readSrc("app/api/admin/campaigns/[id]/pause/route.ts").includes("pauseCampaign"));
    assert.ok(readSrc("app/api/admin/campaigns/[id]/publish/route.ts").includes("publishCampaign"));
  });
});

describe("generic status bypass yok", () => {
  it("PATCH campaign status reddi", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-schemas.ts");
    assert.ok(src.includes("generic PATCH ile değiştirilemez"));
  });

  it("targeting PUT requireSuperAdminApi", () => {
    assert.ok(
      readSrc("app/api/admin/campaigns/[id]/targeting/route.ts").includes("requireSuperAdminApi")
    );
  });
});

describe("tenant admin reddi", () => {
  it("targeting route SUPER_ADMIN kontrolü", () => {
    const auth = readSrc("lib/admin-auth.ts");
    assert.ok(auth.includes("SUPER_ADMIN"));
    assert.ok(readSrc("app/api/admin/campaigns/[id]/targeting/route.ts").includes("requireSuperAdminApi"));
  });
});

describe("N+1 optimizasyon", () => {
  it("loadFinalizedRedemptionCountMap groupBy kullanır", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-redemption-utils.ts");
    assert.ok(src.includes("groupBy"));
    assert.ok(readSrc("lib/admin/promotions/campaign-query-service.ts").includes("loadFinalizedRedemptionCountMap"));
  });
});

describe("audit/cache targeting", () => {
  it("audit servisi MembershipCampaign entityType", () => {
    const src = readSrc("lib/admin/campaigns/admin-campaign-audit-service.ts");
    assert.ok(src.includes("MembershipCampaign"));
    assert.ok(src.includes("campaignId"));
  });
});
