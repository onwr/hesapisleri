import "server-only";

import { db } from "@/lib/prisma";
import {
  type ExchangeRateDisplay,
  type ExchangeRates,
  getExchangeWindowKey,
  isSnapshotStale,
  normalizeExchangeRates,
} from "@/lib/exchange-rate-utils";

const EXCHANGE_API_URL = "https://open.er-api.com/v6/latest/TRY";
const EXCHANGE_SOURCE = "open.er-api.com";
const WINDOW_MS = 6 * 60 * 60 * 1000;

let refreshInFlight: Promise<ExchangeRateDisplay | null> | null = null;

async function fetchExternalExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch(EXCHANGE_API_URL, {
    next: { revalidate: 0 },
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Döviz API hatası: ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };

  if (payload.result !== "success" || !payload.rates) {
    throw new Error("Döviz API yanıtı geçersiz.");
  }

  const tryPerUsd = payload.rates.USD;
  const tryPerEur = payload.rates.EUR;
  const tryPerGbp = payload.rates.GBP;

  if (!tryPerUsd || !tryPerEur || !tryPerGbp) {
    throw new Error("Gerekli para birimleri API yanıtında yok.");
  }

  return normalizeExchangeRates({
    USD: 1 / tryPerUsd,
    EUR: 1 / tryPerEur,
    GBP: 1 / tryPerGbp,
  });
}

function mapSnapshotToDisplay(
  snapshot: {
    rates: unknown;
    fetchedAt: Date;
    expiresAt: Date;
    source: string;
    windowKey: string;
  },
  now = new Date()
): ExchangeRateDisplay {
  return {
    rates: normalizeExchangeRates(snapshot.rates as Record<string, unknown>),
    fetchedAt: snapshot.fetchedAt,
    source: snapshot.source,
    isStale: isSnapshotStale(snapshot.expiresAt, now),
    windowKey: snapshot.windowKey,
  };
}

async function getLatestSuccessfulSnapshot() {
  return db.exchangeRateSnapshot.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { fetchedAt: "desc" },
  });
}

export async function fetchAndStoreExchangeRatesForWindow(
  windowKey = getExchangeWindowKey()
) {
  const existing = await db.exchangeRateSnapshot.findUnique({
    where: { windowKey },
  });

  if (existing?.status === "SUCCESS") {
    return mapSnapshotToDisplay(existing);
  }

  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + WINDOW_MS);

  try {
    const rates = await fetchExternalExchangeRates();

    const snapshot = await db.exchangeRateSnapshot.upsert({
      where: { windowKey },
      create: {
        baseCurrency: "TRY",
        rates,
        source: EXCHANGE_SOURCE,
        windowKey,
        fetchedAt,
        expiresAt,
        status: "SUCCESS",
      },
      update: {
        rates,
        source: EXCHANGE_SOURCE,
        fetchedAt,
        expiresAt,
        status: "SUCCESS",
        errorMessage: null,
      },
    });

    return mapSnapshotToDisplay(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Döviz kurları alınamadı.";

    await db.exchangeRateSnapshot.upsert({
      where: { windowKey },
      create: {
        baseCurrency: "TRY",
        rates: {},
        source: EXCHANGE_SOURCE,
        windowKey,
        fetchedAt,
        expiresAt,
        status: "FAILED",
        errorMessage: message,
      },
      update: {
        fetchedAt,
        expiresAt,
        status: "FAILED",
        errorMessage: message,
      },
    });

    throw error;
  }
}

async function refreshExchangeRatesOnce() {
  if (!refreshInFlight) {
    refreshInFlight = fetchAndStoreExchangeRatesForWindow()
      .catch(async () => {
        const fallback = await getLatestSuccessfulSnapshot();
        return fallback ? mapSnapshotToDisplay(fallback) : null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function getDashboardExchangeRates(): Promise<ExchangeRateDisplay | null> {
  const now = new Date();
  const currentWindow = getExchangeWindowKey(now);

  try {
    const current = await db.exchangeRateSnapshot.findUnique({
      where: { windowKey: currentWindow },
    });

    if (current?.status === "SUCCESS") {
      return mapSnapshotToDisplay(current, now);
    }

    const latest = await getLatestSuccessfulSnapshot();
    if (latest) {
      return mapSnapshotToDisplay(latest, now);
    }

    return await refreshExchangeRatesOnce();
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (code === "P2021") {
      console.warn(
        "ExchangeRateSnapshot tablosu yok; migration deploy gerekli."
      );
      return null;
    }

    return null;
  }
}
