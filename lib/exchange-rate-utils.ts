export type ExchangeRates = {
  USD: number;
  EUR: number;
  GBP: number;
};

export type ExchangeRateDisplay = {
  rates: ExchangeRates;
  fetchedAt: Date;
  source: string;
  isStale: boolean;
  windowKey: string | null;
};

const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP"] as const;

export function getExchangeWindowKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const windowHour = Math.floor(hour / 6) * 6;

  return `${year}-${month}-${day}-${String(windowHour).padStart(2, "0")}`;
}

export function normalizeExchangeRates(input: Record<string, unknown>): ExchangeRates {
  const rates = {} as ExchangeRates;

  for (const currency of DISPLAY_CURRENCIES) {
    const value = Number(input[currency]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Geçersiz kur değeri: ${currency}`);
    }
    rates[currency] = Math.round(value * 100) / 100;
  }

  return rates;
}

export function isSnapshotStale(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function formatExchangeRateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
