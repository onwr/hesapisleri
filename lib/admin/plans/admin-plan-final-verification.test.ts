/**
 * Admin plan final doğrulama testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { evaluatePlanDeleteEligibility } from "@/lib/admin/plans/admin-plan-delete-eligibility";
import {
  isAdminWizardPricePolicy,
  policyAffectsExistingSubscribersNow,
  policyPreservesCurrentPeriod,
} from "@/lib/admin/plans/admin-plan-price-policy-utils";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import {
  getPlanListStatusLabel,
  isPlanPassive,
  isPlanSalesActive,
} from "@/lib/admin/plans/admin-plan-status-labels";
import { createAdminPlanPricePreview } from "@/lib/admin/plans/admin-plan-price-preview-service";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("auth secret — NextAuth yok, JWT oturum", () => {
  it("package.json next-auth içermez", () => {
    const pkg = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal("next-auth" in deps, false);
    assert.equal("@auth/core" in deps, false);
  });

  it("admin preview NEXTAUTH_SECRET kullanmaz", () => {
    const preview = readSrc("lib/admin/plans/admin-plan-price-preview-service.ts");
    const hash = readSrc("lib/admin/plans/admin-plan-preview-hash.ts");
    assert.ok(!preview.includes("NEXTAUTH_SECRET"));
    assert.ok(!hash.includes("getAdminPlanPricePreviewSigningKey"));
    assert.ok(!preview.includes("signPlanPricePreview"));
    assert.ok(!preview.includes("verifyPlanPricePreview"));
  });

  it("admin preview imzalı token üretmez", () => {
    const preview = readSrc("lib/admin/plans/admin-plan-price-preview-service.ts");
    assert.ok(preview.includes("expectedCurrentPriceId"));
    assert.ok(!preview.includes("previewToken"));
  });

  it("preview/publish route session + origin guard", () => {
    const previewRoute = readSrc("app/api/admin/plans/[id]/prices/preview/route.ts");
    const publishRoute = readSrc("app/api/admin/plans/[id]/prices/publish/route.ts");
    assert.ok(previewRoute.includes("requireSuperAdminApi"));
    assert.ok(publishRoute.includes("requireSuperAdminApi"));
    assert.ok(previewRoute.includes("verifyApiMutationOrigin"));
    assert.ok(publishRoute.includes("verifyApiMutationOrigin"));
  });

  it("UI kaynaklarında teknik env mesajı yok", () => {
    const patterns = ["NEXTAUTH_SECRET", "PLAN_PRICE_PREVIEW_SECRET yapılandırılmamış"];
    const files = [
      "components/admin/plans/admin-plan-price-wizard.tsx",
      "components/admin/plans/admin-plan-row-actions.tsx",
      "app/api/admin/plans/[id]/prices/preview/route.ts",
    ];
    for (const file of files) {
      const src = readSrc(file);
      for (const p of patterns) {
        assert.ok(!src.includes(p), `${file} contains ${p}`);
      }
    }
  });
});

describe("kullanılmamış plan silme", () => {
  it("yalnız başlangıç fiyatı silmeyi engellemez", () => {
    const result = evaluatePlanDeleteEligibility({
      subscriptions: 0,
      payments: 0,
      priceLinkedSubscriptions: 0,
      priceLinkedPayments: 0,
      couponScopes: 0,
      campaignScopes: 0,
    });
    assert.equal(result.canHardDelete, true);
  });

  it("aktif fiyat kaydı tek başına engel değil", () => {
    const withOnlyDraftPrices = evaluatePlanDeleteEligibility({
      subscriptions: 0,
      payments: 0,
      priceLinkedSubscriptions: 0,
      priceLinkedPayments: 0,
      couponScopes: 0,
      campaignScopes: 0,
    });
    assert.equal(withOnlyDraftPrices.canHardDelete, true);
  });

  it("abonelik varsa engeller", () => {
    const result = evaluatePlanDeleteEligibility({
      subscriptions: 1,
      payments: 0,
      priceLinkedSubscriptions: 0,
      priceLinkedPayments: 0,
      couponScopes: 0,
      campaignScopes: 0,
    });
    assert.equal(result.canHardDelete, false);
    assert.ok(result.reasons.includes("abonelik"));
  });

  it("fiyat-abonelik ilişkisi varsa engeller", () => {
    const result = evaluatePlanDeleteEligibility({
      subscriptions: 0,
      payments: 0,
      priceLinkedSubscriptions: 1,
      priceLinkedPayments: 0,
      couponScopes: 0,
      campaignScopes: 0,
    });
    assert.equal(result.canHardDelete, false);
  });

  it("delete servisi cascade öncesi notları soft-delete eder", () => {
    const src = readSrc("lib/admin/plans/admin-plan-delete-service.ts");
    assert.ok(src.includes("adminPlanNote.updateMany"));
    assert.ok(!src.includes('status: { in: ["ACTIVE", "EXPIRED", "SCHEDULED"] }'));
  });
});

describe("fiyat politikaları", () => {
  it("sihirbazda yalnız desteklenen 3 politika", () => {
    assert.equal(isAdminWizardPricePolicy("NEW_SUBSCRIBERS_ONLY"), true);
    assert.equal(isAdminWizardPricePolicy("NEXT_RENEWAL"), true);
    assert.equal(isAdminWizardPricePolicy("AFTER_DATE"), true);
    assert.equal(isAdminWizardPricePolicy("GRANDFATHERED"), false);
  });

  it("yalnızca yeni aboneler mevcut dönemi korur", () => {
    assert.equal(policyPreservesCurrentPeriod("NEW_SUBSCRIBERS_ONLY"), true);
    assert.equal(policyAffectsExistingSubscribersNow("NEW_SUBSCRIBERS_ONLY"), false);
  });

  it("yenileme politikası mevcut dönemi korur", () => {
    assert.equal(policyPreservesCurrentPeriod("NEXT_RENEWAL"), true);
    assert.equal(policyAffectsExistingSubscribersNow("NEXT_RENEWAL"), false);
  });

  it("tarihli politika mevcut dönemi hemen değiştirebilir", () => {
    assert.equal(policyAffectsExistingSubscribersNow("AFTER_DATE"), true);
    assert.equal(policyPreservesCurrentPeriod("AFTER_DATE"), false);
  });

  it("backend publish servisi üç politikayı uygular", () => {
    const src = readSrc("lib/admin/plans/admin-plan-price-publish-service.ts");
    assert.ok(src.includes('case "NEW_SUBSCRIBERS_ONLY"'));
    assert.ok(src.includes('case "NEXT_RENEWAL"'));
    assert.ok(src.includes('case "AFTER_DATE"'));
    assert.ok(src.includes("nextPlanPriceId"));
    assert.ok(src.includes("lockSubscriptionToCurrentPrice"));
  });
});

describe("pasif ve arşiv", () => {
  it("pasif = ACTIVE + !isActive, taslak = DRAFT", () => {
    assert.equal(getPlanListStatusLabel("DRAFT", false), "Taslak");
    assert.equal(getPlanListStatusLabel("ACTIVE", false), "Pasif");
    assert.equal(getPlanListStatusLabel("ACTIVE", true), "Aktif");
    assert.equal(isPlanPassive("ACTIVE", false), true);
    assert.equal(isPlanSalesActive("ACTIVE", true), true);
  });

  it("deactivate planStatus DRAFT yapmaz", () => {
    const fn = readSrc("lib/admin/plans/admin-plan-action-service.ts");
    const deactivate = fn.slice(fn.indexOf("export async function deactivateAdminPlan"));
    assert.ok(!deactivate.includes('planStatus: "DRAFT"'));
    assert.ok(deactivate.includes("isActive: false"));
  });

  it("pasif ve arşivli plan checkout kapalı", () => {
    const base = {
      code: "standard" as const,
      planStatus: "ACTIVE" as const,
      visibility: "PUBLIC" as const,
      pricingClass: "PAID" as const,
      hasPriceConflicts: false,
    };
    assert.equal(isPlanCheckoutAvailable({ ...base, isActive: false }), false);
    assert.equal(
      isPlanCheckoutAvailable({ ...base, isActive: true, planStatus: "ARCHIVED" }),
      false
    );
    assert.equal(isPlanCheckoutAvailable({ ...base, isActive: true }), true);
  });

  it("arşiv visibility public yapmaz", () => {
    const src = readSrc("lib/admin/plans/admin-plan-action-service.ts");
    assert.ok(src.includes('visibility: plan.visibility === "PUBLIC" ? "PRIVATE"'));
  });
});

describe("önizleme DB write yapmaz", () => {
  it("createAdminPlanPricePreview yalnızca okuma yapar", () => {
    const src = readSrc("lib/admin/plans/admin-plan-price-preview-service.ts");
    const fnBody = src.slice(src.indexOf("export async function createAdminPlanPricePreview"));
    const publishFn = fnBody.slice(0, fnBody.indexOf("export async function publishAdminPlanPriceFromPreview"));
    assert.ok(!publishFn.includes("membershipPlanPrice.create"));
    assert.ok(!publishFn.includes("$transaction"));
  });
});
