import type { AppliedDiscount } from "@/lib/billing/price-resolution-service";
import type { ResolvedPriceTotals } from "@/lib/billing/pricing-utils";

export type PriceBreakdownStep = {
  order: number;
  key: string;
  label: string;
  amountMinor: number;
  currency: string;
  detail?: string;
};

export function buildPriceBreakdownSteps(input: {
  currency: string;
  listPriceMinor: number;
  salePriceMinor: number;
  priceSource: string;
  appliedDiscounts: AppliedDiscount[];
  vatMinor: number;
  subtotalMinor: number;
  totalMinor: number;
  monthlyEquivalentMinor: number;
  companyOverrideMinor?: number | null;
}) {
  const planDiscount = input.appliedDiscounts
    .filter((d) => d.type === "PLAN")
    .reduce((s, d) => s + d.amountMinor, 0);
  const campaignDiscount = input.appliedDiscounts
    .filter((d) => d.type === "CAMPAIGN")
    .reduce((s, d) => s + d.amountMinor, 0);
  const couponDiscount = input.appliedDiscounts
    .filter((d) => d.type === "COUPON")
    .reduce((s, d) => s + d.amountMinor, 0);

  const planListMinor = input.listPriceMinor;
  const planSaleMinor =
    planListMinor -
    planDiscount -
    (input.priceSource === "COMPANY_OVERRIDE" ? 0 : 0);

  const steps: PriceBreakdownStep[] = [
    {
      order: 1,
      key: "plan_list",
      label: "Plan liste fiyatı",
      amountMinor: planListMinor,
      currency: input.currency,
    },
    {
      order: 2,
      key: "plan_sale",
      label: "Plan satış fiyatı",
      amountMinor: planSaleMinor,
      currency: input.currency,
      detail: planDiscount > 0 ? `Dönem indirimi: −${planDiscount}` : undefined,
    },
  ];

  if (input.priceSource === "COMPANY_OVERRIDE" && input.companyOverrideMinor != null) {
    steps.push({
      order: 3,
      key: "company_override",
      label: "Firma fiyat override",
      amountMinor: input.companyOverrideMinor,
      currency: input.currency,
    });
  }

  if (campaignDiscount > 0) {
    steps.push({
      order: 4,
      key: "campaign_discount",
      label: "Kampanya indirimi",
      amountMinor: -campaignDiscount,
      currency: input.currency,
    });
  }

  if (couponDiscount > 0) {
    steps.push({
      order: 5,
      key: "coupon_discount",
      label: "Kupon indirimi",
      amountMinor: -couponDiscount,
      currency: input.currency,
    });
  }

  steps.push(
    {
      order: 6,
      key: "subtotal",
      label: "Ara toplam (vergi öncesi)",
      amountMinor: input.subtotalMinor,
      currency: input.currency,
    },
    {
      order: 7,
      key: "vat",
      label: "Vergi (KDV)",
      amountMinor: input.vatMinor,
      currency: input.currency,
    },
    {
      order: 8,
      key: "final_total",
      label: "Final toplam",
      amountMinor: input.totalMinor,
      currency: input.currency,
    },
    {
      order: 9,
      key: "monthly_equivalent",
      label: "Aylık karşılık",
      amountMinor: input.monthlyEquivalentMinor,
      currency: input.currency,
    }
  );

  return steps.sort((a, b) => a.order - b.order);
}

export function aggregateAddOnLines(
  lines: Array<{ currency: string; totalMinor: number; lineSaleMinor: number }>,
  planCurrency: string
) {
  const issues: string[] = [];
  let addOnSubtotalMinor = 0;

  for (const line of lines) {
    if (line.currency !== planCurrency) {
      issues.push(
        `ADDON_CURRENCY_MISMATCH: ${line.currency} add-on ${planCurrency} plan ile toplanamaz.`
      );
      continue;
    }
    addOnSubtotalMinor += line.totalMinor;
  }

  return { addOnSubtotalMinor, currencyIssues: issues };
}

export function computeGrandTotal(input: {
  planTotalMinor: number;
  addOnSubtotalMinor: number;
  planCurrency: string;
}) {
  return {
    grandTotalMinor: input.planTotalMinor + input.addOnSubtotalMinor,
    currency: input.planCurrency,
  };
}

export function stackingOrderFromDiscounts(discounts: AppliedDiscount[]) {
  const order = ["PLAN", "OVERRIDE", "CAMPAIGN", "COUPON", "PARTNER"] as const;
  return order
    .map((type) => discounts.filter((d) => d.type === type))
    .flat()
    .map((d, index) => ({
      position: index + 1,
      type: d.type,
      id: d.id ?? null,
      code: d.code ?? null,
      label: d.label,
      amountMinor: d.amountMinor,
    }));
}

export function ensureNonNegativeFinal(totalMinor: number) {
  if (totalMinor < 0) {
    return { ok: false as const, message: "Final fiyat negatif olamaz." };
  }
  return { ok: true as const, totalMinor };
}

export type ResolvedPlanSlice = ResolvedPriceTotals & {
  planPriceId: string;
  priceVersion: number;
  priceSource: string;
  appliedDiscounts: AppliedDiscount[];
};
