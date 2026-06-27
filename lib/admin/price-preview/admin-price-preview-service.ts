import "server-only";

import { db } from "@/lib/prisma";
import { previewAddOnPrice } from "@/lib/admin/addons/admin-addon-preview-service";
import { previewCampaignPrice } from "@/lib/admin/campaigns/admin-campaign-preview-service";
import {
  ANONYMOUS_PREVIEW_COMPANY_ID,
  type PricePreviewIssue,
} from "@/lib/admin/price-preview/admin-price-preview-types";
import {
  getActivePlanPrice,
  PriceResolutionConflictError,
  PriceResolutionError,
  resolveSubscriptionPrice,
} from "@/lib/billing/price-resolution-service";
import { resolveCompanyEntitlements } from "@/lib/billing/entitlements/entitlement-resolution-service";
import {
  aggregateAddOnLines,
  buildPriceBreakdownSteps,
  computeGrandTotal,
  ensureNonNegativeFinal,
  stackingOrderFromDiscounts,
} from "@/lib/admin/price-preview/admin-price-preview-breakdown";
import { comparePricePreviewScenarios } from "@/lib/admin/price-preview/admin-price-preview-compare";
import { PricePreviewServiceError } from "@/lib/admin/price-preview/admin-price-preview-errors";
import {
  adminPricePreviewRequestSchema,
  adminPricePreviewScenarioInputSchema,
  assertNoForbiddenPreviewPriceKeys,
} from "@/lib/admin/price-preview/admin-price-preview-schemas";
import { redactPreviewPayload } from "@/lib/admin/price-preview/admin-price-preview-redact";
import {
  resolvePreviewCompanyId,
  validateSubscriptionBelongsToCompany,
} from "@/lib/admin/price-preview/admin-price-preview-validation";
import type { z } from "zod";

type ScenarioInput = z.infer<typeof adminPricePreviewScenarioInputSchema>;

export async function getPricePreviewOptions() {
  const [plans, campaigns, addOns, companies] = await Promise.all([
    db.membershipPlan.findMany({
      where: { planStatus: { in: ["ACTIVE", "DRAFT"] } },
      select: {
        id: true,
        name: true,
        code: true,
        planStatus: true,
        visibility: true,
        defaultCurrency: true,
        currency: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.membershipCampaign.findMany({
      where: { status: { in: ["ACTIVE", "SCHEDULED", "DRAFT"] } },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        autoApply: true,
        currency: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 200,
    }),
    db.membershipAddOn.findMany({
      where: { status: "ACTIVE", isPublic: true },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        currency: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return {
    plans,
    campaigns,
    addOns,
    companies,
    intervals: ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const,
    currencies: ["TRY", "USD", "EUR"] as const,
    scenarios: ["NEW_SUBSCRIPTION", "RENEWAL", "PLAN_CHANGE"] as const,
  };
}

async function loadSubscriptionContext(input: {
  companyId: string | null;
  subscriptionId?: string | null;
}) {
  if (input.subscriptionId) {
    const sub = await db.companySubscription.findUnique({
      where: { id: input.subscriptionId },
      include: {
        plan: { select: { id: true, name: true, code: true } },
        lockedPlanPrice: {
          select: {
            id: true,
            version: true,
            listPriceMinor: true,
            salePriceMinor: true,
            currency: true,
          },
        },
        nextPlanPrice: {
          select: {
            id: true,
            version: true,
            listPriceMinor: true,
            salePriceMinor: true,
            currency: true,
            effectiveFrom: true,
          },
        },
      },
    });
    if (!sub) throw new PricePreviewServiceError("Abonelik bulunamadı.", 404);
    validateSubscriptionBelongsToCompany({
      subscriptionCompanyId: sub.companyId,
      companyId: input.companyId,
    });
    return sub;
  }

  if (!input.companyId || input.companyId === ANONYMOUS_PREVIEW_COMPANY_ID) {
    return null;
  }

  return db.companySubscription.findUnique({
    where: { companyId: input.companyId },
    include: {
      plan: { select: { id: true, name: true, code: true } },
      lockedPlanPrice: {
        select: {
          id: true,
          version: true,
          listPriceMinor: true,
          salePriceMinor: true,
          currency: true,
        },
      },
      nextPlanPrice: {
        select: {
          id: true,
          version: true,
          listPriceMinor: true,
          salePriceMinor: true,
          currency: true,
          effectiveFrom: true,
        },
      },
    },
  });
}

async function loadCompanyOverrides(companyId: string, planId: string, at: Date) {
  if (!companyId || companyId === ANONYMOUS_PREVIEW_COMPANY_ID) return [];
  return db.companyPlanPriceOverride.findMany({
    where: {
      companyId,
      planId,
      status: "ACTIVE",
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

function buildEntitlementCodes(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot
    .map((row) => (typeof row === "object" && row && "code" in row ? String(row.code) : null))
    .filter((c): c is string => Boolean(c));
}

async function executeScenarioPreview(input: ScenarioInput) {
  assertNoForbiddenPreviewPriceKeys(input as Record<string, unknown>);
  const parsed = adminPricePreviewScenarioInputSchema.parse(input);
  const at = new Date(parsed.effectiveDate);
  const issues: PricePreviewIssue[] = [];

  const explicitCompanyId = resolvePreviewCompanyId(parsed.companyId);
  const isAnonymous = !explicitCompanyId;
  const companyId = explicitCompanyId ?? ANONYMOUS_PREVIEW_COMPANY_ID;

  const subscription = await loadSubscriptionContext({
    companyId: explicitCompanyId,
    subscriptionId: parsed.subscriptionId,
  });

  if (parsed.scenario === "RENEWAL" && isAnonymous) {
    throw new PricePreviewServiceError("Yenileme senaryosu için firma seçimi zorunludur.", 400);
  }
  if (parsed.scenario === "PLAN_CHANGE" && !subscription) {
    throw new PricePreviewServiceError("Plan değişikliği için abonelik seçimi zorunludur.", 400);
  }

  const plan = await db.membershipPlan.findUnique({ where: { id: parsed.planId } });
  if (!plan) throw new PricePreviewServiceError("Plan bulunamadı.", 404);

  if (plan.planStatus === "ARCHIVED") {
    issues.push({
      code: "PLAN_ARCHIVED",
      message: "Plan arşivlenmiş.",
      severity: "error",
    });
  }
  if (plan.visibility !== "PUBLIC" && isAnonymous) {
    issues.push({
      code: "PLAN_NOT_PUBLIC",
      message: "Plan herkese açık değil; anonim checkout uygun olmayabilir.",
      severity: "warning",
    });
  }

  const currency = parsed.currency ?? plan.defaultCurrency ?? plan.currency;

  try {
    await getActivePlanPrice({
      planId: parsed.planId,
      billingInterval: parsed.billingInterval,
      currency,
      at,
    });
  } catch (error) {
    if (error instanceof PriceResolutionConflictError) {
      issues.push({
        code: "PRICE_RESOLUTION_CONFLICT",
        message: error.message,
        severity: "error",
      });
    } else {
      issues.push({
        code: "PLAN_PRICE_NOT_FOUND",
        message: "Geçerli plan fiyatı bulunamadı.",
        severity: "error",
      });
    }
  }

  const isRenewal =
    parsed.scenario === "RENEWAL" ||
    (parsed.scenario === "PLAN_CHANGE" && parsed.planChangeApplyAt === "NEXT_PERIOD");

  let resolved;
  try {
    resolved = await resolveSubscriptionPrice({
      companyId,
      planId: parsed.planId,
      billingInterval: parsed.billingInterval,
      couponCode: parsed.couponCode,
      isRenewal,
      now: at,
    });
  } catch (error) {
    const message =
      error instanceof PriceResolutionError ? error.message : "Fiyat çözümlenemedi.";
    if (message.includes("Kupon")) {
      issues.push({ code: "COUPON_NOT_ELIGIBLE", message, severity: "error" });
    } else if (message.includes("limit")) {
      issues.push({ code: "COUPON_USAGE_LIMIT_REACHED", message, severity: "error" });
    } else if (message.includes("kampanya")) {
      issues.push({ code: "STACKING_CONFLICT", message, severity: "error" });
    } else {
      issues.push({ code: "PLAN_PRICE_NOT_FOUND", message, severity: "error" });
    }
    resolved = null;
  }

  if (resolved && resolved.currency !== currency) {
    issues.push({
      code: "CURRENCY_MISMATCH",
      message: `İstenen para birimi (${currency}) çözülen fiyat (${resolved.currency}) ile uyumsuz.`,
      severity: "error",
    });
  }

  let campaignPreview = null;
  if (parsed.campaignId && explicitCompanyId) {
    try {
      campaignPreview = await previewCampaignPrice(parsed.campaignId, {
        companyId,
        planId: parsed.planId,
        billingInterval: parsed.billingInterval,
        isRenewal,
      });
      if (!campaignPreview.eligible) {
        issues.push({
          code: "CAMPAIGN_NOT_ELIGIBLE",
          message: campaignPreview.ineligibleReasons.join(" "),
          severity: "warning",
        });
      } else if (
        resolved &&
        parsed.campaignId &&
        "campaign" in campaignPreview &&
        !resolved.campaignIds.includes(parsed.campaignId) &&
        !campaignPreview.campaign.autoApply
      ) {
        issues.push({
          code: "CAMPAIGN_NOT_ELIGIBLE",
          message: "Seçilen kampanya otomatik uygulanmadı.",
          severity: "warning",
        });
      }
    } catch {
      issues.push({
        code: "CAMPAIGN_NOT_ELIGIBLE",
        message: "Kampanya önizlemesi başarısız.",
        severity: "warning",
      });
    }
  }

  const overrides = await loadCompanyOverrides(companyId, parsed.planId, at);

  const addOnLines = [];
  for (const row of parsed.addOns ?? []) {
    try {
      const line = await previewAddOnPrice(row.addOnId, {
        quantity: row.quantity,
        billingInterval: parsed.billingInterval,
        currency,
      });
      if (!line.eligible) {
        issues.push({
          code: "ADDON_PRICE_NOT_FOUND",
          message: line.ineligibleReasons.join(" ") || "Add-on uygun değil.",
          severity: "warning",
        });
      }
      if (line.currency !== currency) {
        issues.push({
          code: "ADDON_CURRENCY_MISMATCH",
          message: `${line.addOn.code} para birimi plan ile uyumsuz.`,
          severity: "error",
        });
      }
      addOnLines.push({
        ...line,
        quantity: row.quantity,
      });
    } catch {
      issues.push({
        code: "ADDON_PRICE_NOT_FOUND",
        message: "Add-on fiyatı çözümlenemedi.",
        severity: "error",
      });
    }
  }

  const { addOnSubtotalMinor, currencyIssues } = aggregateAddOnLines(
    addOnLines.map((l) => ({
      currency: l.currency,
      totalMinor: l.totalMinor,
      lineSaleMinor: l.lineSaleMinor,
    })),
    currency
  );
  for (const msg of currencyIssues) {
    issues.push({
      code: "ADDON_CURRENCY_MISMATCH",
      message: msg,
      severity: "error",
    });
  }

  let entitlements = null;
  if (explicitCompanyId) {
    try {
      entitlements = await resolveCompanyEntitlements(explicitCompanyId, { skipCache: true });
    } catch {
      issues.push({
        code: "ENTITLEMENT_RESOLUTION_WARNING",
        message: "Firma entitlement çözümlemesi tamamlanamadı.",
        severity: "warning",
      });
    }
  }

  if (subscription && !subscription.lockedPlanPriceId && parsed.scenario === "RENEWAL") {
    if (subscription.priceLockType && subscription.lockedPriceMinor == null) {
      issues.push({
        code: "LOCKED_PRICE_NOT_FOUND",
        message: "Kilitli fiyat tipi var ancak tutar bulunamadı.",
        severity: "warning",
      });
    }
  }
  if (subscription?.nextPlanPriceId && !subscription.nextPlanPrice) {
    issues.push({
      code: "NEXT_PRICE_NOT_FOUND",
      message: "Sonraki fiyat kaydı bulunamadı.",
      severity: "warning",
    });
  }

  const planTotalMinor = resolved?.totalMinor ?? 0;
  const nonNegative = ensureNonNegativeFinal(planTotalMinor + addOnSubtotalMinor);
  if (!nonNegative.ok) {
    issues.push({
      code: "STACKING_CONFLICT",
      message: nonNegative.message,
      severity: "error",
    });
  }

  const grand = computeGrandTotal({
    planTotalMinor,
    addOnSubtotalMinor,
    planCurrency: currency,
  });

  const breakdown = resolved
    ? buildPriceBreakdownSteps({
        currency: resolved.currency,
        listPriceMinor: resolved.listPriceMinor,
        salePriceMinor: resolved.salePriceMinor,
        priceSource: resolved.priceSource,
        appliedDiscounts: resolved.appliedDiscounts,
        vatMinor: resolved.vatMinor,
        subtotalMinor: resolved.subtotalMinor,
        totalMinor: resolved.totalMinor,
        monthlyEquivalentMinor: resolved.monthlyEquivalentMinor,
        companyOverrideMinor:
          resolved.priceSource === "COMPANY_OVERRIDE" ? resolved.salePriceMinor : null,
      })
    : [];

  const stacking = resolved ? stackingOrderFromDiscounts(resolved.appliedDiscounts) : [];

  let planChange = null;
  if (parsed.scenario === "PLAN_CHANGE" && subscription && resolved) {
    const currentEntitlements = subscription.planId
      ? await db.planEntitlement.findMany({
          where: { planId: subscription.planId },
          select: { code: true, booleanValue: true, numberValue: true },
        })
      : [];
    const targetEntitlements = await db.planEntitlement.findMany({
      where: { planId: parsed.planId },
      select: { code: true, booleanValue: true, numberValue: true },
    });
    const targetCodes = new Set(targetEntitlements.map((e) => e.code));
    const entitlementDiff = {
      added: targetEntitlements
        .filter((t) => !currentEntitlements.some((c) => c.code === t.code))
        .map((e) => e.code),
      changed: targetEntitlements
        .filter((t) => {
          const cur = currentEntitlements.find((c) => c.code === t.code);
          if (!cur) return false;
          return (
            cur.booleanValue !== t.booleanValue || cur.numberValue !== t.numberValue
          );
        })
        .map((e) => e.code),
      removed: currentEntitlements
        .filter((c) => !targetCodes.has(c.code))
        .map((e) => e.code),
    };

    planChange = {
      currentPlan: subscription.plan,
      targetPlan: { id: plan.id, name: plan.name, code: plan.code },
      effectiveMode: parsed.planChangeApplyAt ?? "IMMEDIATELY",
      priceDeltaMinor: resolved.totalMinor,
      entitlementDiff,
    };
  }

  const eligible =
    issues.filter((i) => i.severity === "error").length === 0 && Boolean(resolved);

  return {
    eligible,
    scenario: parsed.scenario,
    effectiveDate: at.toISOString(),
    isAnonymous,
    company: explicitCompanyId
      ? { id: explicitCompanyId, subscriptionId: subscription?.id ?? null }
      : null,
    plan: resolved
      ? {
          id: resolved.planId,
          name: resolved.planName,
          planPriceId: resolved.planPriceId,
          priceVersion: resolved.priceVersion,
          priceSource: resolved.priceSource,
          billingInterval: resolved.billingInterval,
          currency: resolved.currency,
          listPriceMinor: resolved.listPriceMinor,
          salePriceMinor: resolved.salePriceMinor,
          vatRate: resolved.vatRate,
          vatIncluded: resolved.vatIncluded,
          subtotalMinor: resolved.subtotalMinor,
          vatMinor: resolved.vatMinor,
          totalMinor: resolved.totalMinor,
          monthlyEquivalentMinor: resolved.monthlyEquivalentMinor,
          priceChangePolicy: resolved.priceChangePolicy,
          campaignIds: resolved.campaignIds,
          couponId: resolved.couponId ?? null,
        }
      : null,
    breakdown,
    stacking,
    campaignPreview,
    companyOverrides: overrides.map((o) => ({
      id: o.id,
      billingInterval: o.billingInterval,
      priceMinor: o.priceMinor,
      reason: o.reason,
    })),
    subscriptionContext: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingInterval: subscription.billingInterval,
          lockedPlanPriceId: subscription.lockedPlanPriceId,
          lockedPriceMinor: subscription.lockedPriceMinor,
          lockedListPriceMinor: subscription.lockedListPriceMinor,
          priceLockType: subscription.priceLockType,
          nextPlanPriceId: subscription.nextPlanPriceId,
          nextPriceEffectiveAt: subscription.nextPriceEffectiveAt?.toISOString() ?? null,
          lockedPlanPrice: subscription.lockedPlanPrice,
          nextPlanPrice: subscription.nextPlanPrice,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    addOns: addOnLines.map((l) => ({
      addOnId: l.addOn.id,
      code: l.addOn.code,
      name: l.addOn.name,
      quantity: l.quantity,
      currency: l.currency,
      unitSaleMinor: l.unitSaleMinor,
      lineSaleMinor: l.lineSaleMinor,
      totalMinor: l.totalMinor,
      vatMinor: l.vatMinor,
      entitlement: l.entitlement,
      eligible: l.eligible,
    })),
    totals: {
      planTotalMinor,
      addOnSubtotalMinor,
      grandTotalMinor: grand.grandTotalMinor,
      currency: grand.currency,
    },
    entitlements: entitlements
      ? {
          resolvedAt: entitlements.resolvedAt,
          codes: Object.keys(entitlements.entitlements),
        }
      : null,
    planChange,
    explanation: resolved?.explanation ?? [],
    issues,
    entitlementCodes: buildEntitlementCodes(resolved?.entitlementsSnapshot),
  };
}

export async function executePricePreview(body: Record<string, unknown>) {
  assertNoForbiddenPreviewPriceKeys(body);
  const parsed = adminPricePreviewRequestSchema.parse(body);

  const primary = await executeScenarioPreview(parsed);

  let comparison = null;
  if (parsed.compareWith) {
    const secondary = await executeScenarioPreview(parsed.compareWith);
    comparison = comparePricePreviewScenarios(
      {
        eligible: primary.eligible,
        currency: primary.totals.currency,
        totalMinor: primary.totals.grandTotalMinor,
        monthlyEquivalentMinor: primary.plan?.monthlyEquivalentMinor ?? 0,
        entitlementCodes: primary.entitlementCodes,
        issues: primary.issues,
      },
      {
        eligible: secondary.eligible,
        currency: secondary.totals.currency,
        totalMinor: secondary.totals.grandTotalMinor,
        monthlyEquivalentMinor: secondary.plan?.monthlyEquivalentMinor ?? 0,
        entitlementCodes: secondary.entitlementCodes,
        issues: secondary.issues,
      }
    );
    return redactPreviewPayload({ primary, secondary, comparison });
  }

  return redactPreviewPayload({ primary, comparison });
}
