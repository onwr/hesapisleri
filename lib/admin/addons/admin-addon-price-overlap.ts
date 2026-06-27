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

function allowsSequentialReplacement(existing: PriceRange, incoming: PriceRange): boolean {
  if (existing.effectiveUntil != null) return false;
  return incoming.effectiveFrom.getTime() >= existing.effectiveFrom.getTime();
}

export function assertNoAddOnPriceOverlap(
  candidate: PriceRange,
  existing: PriceRange[],
  context: { addOnId: string; billingInterval: string | null; currency: string }
): void {
  for (const other of existing) {
    if (priceRangesOverlap(candidate, other)) {
      throw new AddOnPriceOverlapError(
        `${context.billingInterval ?? "ONE_TIME"}/${context.currency} için fiyat tarih aralığı çakışıyor.`,
        context
      );
    }
  }
}

export class AddOnPriceOverlapError extends Error {
  status = 409;
  context: { addOnId: string; billingInterval: string | null; currency: string };
  constructor(
    message: string,
    context: { addOnId: string; billingInterval: string | null; currency: string }
  ) {
    super(message);
    this.name = "AddOnPriceOverlapError";
    this.context = context;
  }
}
