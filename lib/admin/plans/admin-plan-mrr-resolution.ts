import type { MembershipPeriod } from "@prisma/client";
import { subscriptionToMonthlyMinor } from "@/lib/admin/admin-overview-metric-utils";

export type MrrPriceSource =
  | "locked_price_minor"
  | "locked_plan_price"
  | "subscription_snapshot"
  | "payment_snapshot"
  | "resolver"
  | "unresolved";

export type MrrResolutionInput = {
  subscriptionId: string;
  status: string;
  billingInterval: MembershipPeriod | null;
  lockedPriceMinor: number | null;
  lockedListPriceMinor: number | null;
  lockedPlanPriceId: string | null;
  lockedPlanPrice: {
    id?: string;
    currency: string;
    monthlyEquivalentMinor: number;
    billingInterval: MembershipPeriod;
    status?: string;
  } | null;
  paymentSnapshot: {
    subscriptionId: string;
    amountMinor: number | null;
    currency: string | null;
    billingPeriodSnapshot: string | null;
    periodMonthsSnapshot: number | null;
    monthlyEquivalentMinor: number | null;
  } | null;
  resolver: {
    monthlyEquivalentMinor: number;
    currency: string;
    billingInterval: MembershipPeriod;
    hasConflict: boolean;
    isRenewalSemantic: boolean;
  } | null;
};

export type MrrResolutionResult = {
  source: MrrPriceSource;
  monthlyMinor: number | null;
  currency: string;
  label: string;
  unresolved: boolean;
  countsForMrr: boolean;
};

const MRR_ELIGIBLE = new Set(["ACTIVE", "CANCEL_AT_PERIOD_END"]);

export function isMrrEligibleStatus(status: string): boolean {
  return MRR_ELIGIBLE.has(status);
}

function intervalFromSnapshot(
  billingPeriod: string | null,
  months: number | null
): MembershipPeriod | null {
  if (months === 12) return "YEARLY";
  if (months === 6) return "SEMI_ANNUAL";
  if (months === 3) return "QUARTERLY";
  if (months === 1) return "MONTHLY";
  if (billingPeriod === "YEARLY") return "YEARLY";
  if (billingPeriod === "QUARTERLY") return "QUARTERLY";
  if (billingPeriod === "SEMI_ANNUAL") return "SEMI_ANNUAL";
  if (billingPeriod === "MONTHLY") return "MONTHLY";
  return null;
}

export function resolveMrrMonthlyMinor(input: MrrResolutionInput): MrrResolutionResult {
  const currency =
    input.lockedPlanPrice?.currency ??
    input.paymentSnapshot?.currency ??
    input.resolver?.currency ??
    "TRY";

  if (!isMrrEligibleStatus(input.status)) {
    return {
      source: "unresolved",
      monthlyMinor: null,
      currency,
      label: "MRR dışı durum",
      unresolved: true,
      countsForMrr: false,
    };
  }

  // 1. lockedPriceMinor (period total → monthly)
  if (input.lockedPriceMinor != null && input.lockedPriceMinor > 0) {
    const monthly = subscriptionToMonthlyMinor({
      billingInterval: input.billingInterval,
      lockedPriceMinor: input.lockedPriceMinor,
      monthlyEquivalentMinor: null,
    });
    if (monthly > 0) {
      return {
        source: "locked_price_minor",
        monthlyMinor: monthly,
        currency,
        label: `Kilitli snapshot ${input.lockedPriceMinor / 100} ${currency}`,
        unresolved: false,
        countsForMrr: true,
      };
    }
  }

  // 2. lockedPlanPrice.monthlyEquivalentMinor
  if (input.lockedPlanPrice && input.lockedPlanPrice.monthlyEquivalentMinor > 0) {
    return {
      source: "locked_plan_price",
      monthlyMinor: input.lockedPlanPrice.monthlyEquivalentMinor,
      currency: input.lockedPlanPrice.currency,
      label: `Kilitli plan fiyatı (${input.lockedPlanPrice.billingInterval})`,
      unresolved: false,
      countsForMrr: true,
    };
  }

  // 3. lockedPlanPriceId var ama kayıt yok → unresolved, başka kaynak kullanma
  if (input.lockedPlanPriceId && !input.lockedPlanPrice) {
    return {
      source: "unresolved",
      monthlyMinor: null,
      currency,
      label: "Fiyat çözümlenemedi",
      unresolved: true,
      countsForMrr: false,
    };
  }

  // 4. subscription snapshot (lockedListPriceMinor as secondary snapshot)
  if (input.lockedListPriceMinor != null && input.lockedListPriceMinor > 0) {
    const monthly = subscriptionToMonthlyMinor({
      billingInterval: input.billingInterval,
      lockedPriceMinor: input.lockedListPriceMinor,
    });
    if (monthly > 0) {
      return {
        source: "subscription_snapshot",
        monthlyMinor: monthly,
        currency,
        label: "Abonelik liste snapshot",
        unresolved: false,
        countsForMrr: true,
      };
    }
  }

  // 5. payment snapshot (same subscription only — validated by caller)
  if (input.paymentSnapshot) {
    if (input.paymentSnapshot.subscriptionId !== input.subscriptionId) {
      return {
        source: "unresolved",
        monthlyMinor: null,
        currency,
        label: "Fiyat çözümlenemedi",
        unresolved: true,
        countsForMrr: false,
      };
    }
    const payMonthly =
      input.paymentSnapshot.monthlyEquivalentMinor ??
      subscriptionToMonthlyMinor({
        billingInterval: intervalFromSnapshot(
          input.paymentSnapshot.billingPeriodSnapshot,
          input.paymentSnapshot.periodMonthsSnapshot
        ),
        lockedPriceMinor: input.paymentSnapshot.amountMinor,
        amountMinor: input.paymentSnapshot.amountMinor,
      });
    if (payMonthly > 0) {
      return {
        source: "payment_snapshot",
        monthlyMinor: payMonthly,
        currency: input.paymentSnapshot.currency ?? currency,
        label: "Son başarılı ödeme snapshot",
        unresolved: false,
        countsForMrr: true,
      };
    }
  }

  // 6. resolver — yalnız renewal semantiği ve conflict yok
  if (
    input.resolver &&
    input.resolver.isRenewalSemantic &&
    !input.resolver.hasConflict &&
    input.resolver.monthlyEquivalentMinor > 0
  ) {
    return {
      source: "resolver",
      monthlyMinor: input.resolver.monthlyEquivalentMinor,
      currency: input.resolver.currency,
      label: "Merkezi resolver (renewal)",
      unresolved: false,
      countsForMrr: true,
    };
  }

  return {
    source: "unresolved",
    monthlyMinor: null,
    currency,
    label: "Fiyat çözümlenemedi",
    unresolved: true,
    countsForMrr: false,
  };
}

export function buildMrrSubInput(
  sub: MrrResolutionInput & { companyId: string },
  resolution: MrrResolutionResult
) {
  if (!resolution.countsForMrr || resolution.monthlyMinor == null) return null;
  return {
    companyId: sub.companyId,
    subscriptionId: sub.subscriptionId,
    lockedPlanPrice: {
      currency: resolution.currency,
      monthlyEquivalentMinor: resolution.monthlyMinor,
    },
  };
}
