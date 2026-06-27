/**
 * Price effective range semantics: [effectiveFrom, effectiveUntil)
 * Start inclusive, end exclusive.
 *
 * Sequential replacement: an open-ended ACTIVE price may be superseded by a
 * new price starting on or after its effectiveFrom (publish sets effectiveUntil).
 */

export type PriceRange = {
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

export function priceRangesOverlap(a: PriceRange, b: PriceRange): boolean {
  if (allowsSequentialReplacement(a, b) || allowsSequentialReplacement(b, a)) {
    return false;
  }

  const aStart = a.effectiveFrom.getTime();
  const aEnd = a.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const bStart = b.effectiveFrom.getTime();
  const bEnd = b.effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return aStart < bEnd && bStart < aEnd;
}

/** Existing open-ended range superseded by a later-starting price (non-overlapping after publish). */
function allowsSequentialReplacement(existing: PriceRange, incoming: PriceRange): boolean {
  if (existing.effectiveUntil != null) return false;
  return incoming.effectiveFrom.getTime() >= existing.effectiveFrom.getTime();
}

export function assertNoPriceOverlap(
  candidate: PriceRange,
  existing: PriceRange[],
  context: { planId: string; billingInterval: string; currency: string }
): void {
  for (const other of existing) {
    if (priceRangesOverlap(candidate, other)) {
      throw new PlanPriceOverlapError(
        `${context.billingInterval}/${context.currency} için fiyat tarih aralığı çakışıyor.`,
        context
      );
    }
  }
}

export class PlanPriceOverlapError extends Error {
  status = 409;
  context: { planId: string; billingInterval: string; currency: string };
  constructor(
    message: string,
    context: { planId: string; billingInterval: string; currency: string }
  ) {
    super(message);
    this.name = "PlanPriceOverlapError";
    this.context = context;
  }
}
