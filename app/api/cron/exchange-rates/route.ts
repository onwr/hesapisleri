import { NextResponse } from "next/server";
import { fetchAndStoreExchangeRatesForWindow } from "@/lib/exchange-rate-service";
import { getExchangeWindowKey } from "@/lib/exchange-rate-utils";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const windowKey = getExchangeWindowKey();
    const snapshot = await fetchAndStoreExchangeRatesForWindow(windowKey);

    return NextResponse.json({
      success: true,
      windowKey,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      rates: snapshot.rates,
      source: snapshot.source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Döviz kuru cron işlemi başarısız.",
      },
      { status: 500 }
    );
  }
}
