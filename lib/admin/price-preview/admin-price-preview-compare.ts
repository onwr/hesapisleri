import type { PricePreviewIssue } from "@/lib/admin/price-preview/admin-price-preview-types";

export type ComparablePreviewResult = {
  eligible: boolean;
  currency: string;
  totalMinor: number;
  monthlyEquivalentMinor: number;
  entitlementCodes: string[];
  issues: PricePreviewIssue[];
};

export function comparePricePreviewScenarios(
  a: ComparablePreviewResult,
  b: ComparablePreviewResult
) {
  if (a.currency !== b.currency) {
    return {
      comparable: false,
      message: "Karşılaştırma için para birimleri aynı olmalıdır.",
      priceDiffMinor: null,
      percentDiff: null,
      monthlyDiffMinor: null,
      entitlementDiff: { added: [] as string[], removed: [] as string[] },
    };
  }

  const priceDiffMinor = b.totalMinor - a.totalMinor;
  const percentDiff =
    a.totalMinor > 0 ? Math.round((priceDiffMinor / a.totalMinor) * 1000) / 10 : null;
  const monthlyDiffMinor = b.monthlyEquivalentMinor - a.monthlyEquivalentMinor;

  const setA = new Set(a.entitlementCodes);
  const setB = new Set(b.entitlementCodes);

  return {
    comparable: true,
    message: null as string | null,
    priceDiffMinor,
    percentDiff,
    monthlyDiffMinor,
    entitlementDiff: {
      added: [...setB].filter((c) => !setA.has(c)),
      removed: [...setA].filter((c) => !setB.has(c)),
    },
    scenarioA: { eligible: a.eligible, totalMinor: a.totalMinor },
    scenarioB: { eligible: b.eligible, totalMinor: b.totalMinor },
  };
}
