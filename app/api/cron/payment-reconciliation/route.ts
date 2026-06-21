import { NextResponse } from "next/server";
import { runPaymentReconciliation } from "@/lib/payments/payment-reconciliation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await runPaymentReconciliation(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Payment reconciliation cron başarısız.",
      },
      { status: 500 }
    );
  }
}
