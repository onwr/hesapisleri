import type { MembershipPeriod } from "@prisma/client";

export const BILLING_INTERVAL_MONTHS: Record<MembershipPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
};

export function getBillingIntervalMonths(interval: MembershipPeriod) {
  return BILLING_INTERVAL_MONTHS[interval];
}

/** Ay sonu ve artık yıl davranışı için merkezi tarih hesabı. */
export function addBillingPeriod(date: Date, interval: MembershipPeriod) {
  const months = getBillingIntervalMonths(interval);
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

export function parseMoneyToMinor(input: string | number): number {
  const raw = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error("Geçersiz para tutarı.");
  }
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatMinorToMoney(amountMinor: number, currency = "TRY") {
  const value = (amountMinor / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "TRY" ? `${value} TL` : `${value} ${currency}`;
}

export function calculateDiscountAmountMinor(
  listPriceMinor: number,
  salePriceMinor: number
) {
  return Math.max(0, listPriceMinor - salePriceMinor);
}

export function calculateDiscountPercent(
  listPriceMinor: number,
  salePriceMinor: number
) {
  if (listPriceMinor <= 0) return 0;
  const amount = calculateDiscountAmountMinor(listPriceMinor, salePriceMinor);
  return Math.round((amount / listPriceMinor) * 1000) / 10;
}

export function calculateMonthlyEquivalentMinor(
  salePriceMinor: number,
  interval: MembershipPeriod
) {
  const months = getBillingIntervalMonths(interval);
  return Math.round(salePriceMinor / months);
}

export function calculateSavingsMinor(
  monthlyListPriceMinor: number,
  intervalSalePriceMinor: number,
  interval: MembershipPeriod
) {
  const months = getBillingIntervalMonths(interval);
  const fullPrice = monthlyListPriceMinor * months;
  return Math.max(0, fullPrice - intervalSalePriceMinor);
}

export function salePriceFromPercent(
  listPriceMinor: number,
  discountPercent: number
) {
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.round(listPriceMinor * (1 - pct / 100));
}

export function validatePricePair(input: {
  listPriceMinor: number;
  salePriceMinor: number;
  discountPercent?: number;
}) {
  if (input.listPriceMinor <= 0) {
    throw new Error("Liste fiyatı sıfırdan büyük olmalıdır.");
  }
  if (input.salePriceMinor <= 0) {
    throw new Error("Satış fiyatı sıfırdan büyük olmalıdır.");
  }
  if (input.salePriceMinor > input.listPriceMinor) {
    throw new Error("Satış fiyatı liste fiyatından yüksek olamaz.");
  }
  if (input.discountPercent != null) {
    const expected = salePriceFromPercent(input.listPriceMinor, input.discountPercent);
    const actualPercent = calculateDiscountPercent(
      input.listPriceMinor,
      input.salePriceMinor
    );
    if (Math.abs(actualPercent - input.discountPercent) > 0.2) {
      throw new Error("İndirim yüzdesi ile satış fiyatı uyuşmuyor.");
    }
    if (Math.abs(expected - input.salePriceMinor) > 1) {
      throw new Error("İndirim yüzdesi ile satış fiyatı uyuşmuyor.");
    }
  }
}

export function calculateVatBreakdown(input: {
  salePriceMinor: number;
  vatRate: number;
  vatIncluded: boolean;
}) {
  const rate = input.vatRate;
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("KDV oranı geçersiz.");
  }

  if (input.vatIncluded) {
    const totalMinor = input.salePriceMinor;
    const subtotalMinor = Math.round(totalMinor / (1 + rate / 100));
    const vatMinor = totalMinor - subtotalMinor;
    return { subtotalMinor, vatMinor, totalMinor };
  }

  const subtotalMinor = input.salePriceMinor;
  const vatMinor = Math.round((subtotalMinor * rate) / 100);
  const totalMinor = subtotalMinor + vatMinor;
  return { subtotalMinor, vatMinor, totalMinor };
}

export type ResolvedPriceTotals = {
  listPriceMinor: number;
  salePriceMinor: number;
  discountMinor: number;
  discountPercent: number;
  monthlyEquivalentMinor: number;
  subtotalMinor: number;
  vatMinor: number;
  totalMinor: number;
  vatRate: number;
  vatIncluded: boolean;
};

export function buildPriceTotals(input: {
  listPriceMinor: number;
  salePriceMinor: number;
  interval: MembershipPeriod;
  vatRate: number;
  vatIncluded: boolean;
  discountPercent?: number;
}): ResolvedPriceTotals {
  validatePricePair({
    listPriceMinor: input.listPriceMinor,
    salePriceMinor: input.salePriceMinor,
    discountPercent: input.discountPercent,
  });

  const discountMinor = calculateDiscountAmountMinor(
    input.listPriceMinor,
    input.salePriceMinor
  );
  const vat = calculateVatBreakdown({
    salePriceMinor: input.salePriceMinor,
    vatRate: input.vatRate,
    vatIncluded: input.vatIncluded,
  });

  return {
    listPriceMinor: input.listPriceMinor,
    salePriceMinor: input.salePriceMinor,
    discountMinor,
    discountPercent: calculateDiscountPercent(
      input.listPriceMinor,
      input.salePriceMinor
    ),
    monthlyEquivalentMinor: calculateMonthlyEquivalentMinor(
      input.salePriceMinor,
      input.interval
    ),
    subtotalMinor: vat.subtotalMinor,
    vatMinor: vat.vatMinor,
    totalMinor: vat.totalMinor,
    vatRate: input.vatRate,
    vatIncluded: input.vatIncluded,
  };
}
