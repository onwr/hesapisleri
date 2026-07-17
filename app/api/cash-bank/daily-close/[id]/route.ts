import { NextResponse } from "next/server";
import { requireApiCashBankRead } from "@/lib/module-access";
import {
  CashDailyClosingError,
  getCashDailyClosingById,
} from "@/lib/cash-daily-closing-service";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiCashBankRead();
    if ("error" in auth) return auth.error;

    const { companyId } = auth;
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "Firma bulunamadı." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const data = await getCashDailyClosingById({
      companyId,
      closingId: id,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof CashDailyClosingError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CASH_DAILY_CLOSE_DETAIL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kapanış detayı alınamadı." },
      { status: 500 }
    );
  }
}
