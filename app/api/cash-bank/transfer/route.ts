import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  applyAccountTransfer,
  transferSchema,
} from "@/lib/cash-bank-account-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = transferSchema.safeParse({
      ...body,
      amount:
        body.amount !== undefined && body.amount !== null
          ? Number(body.amount)
          : body.amount,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await applyAccountTransfer({
      companyId,
      userId,
      data: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transfer tamamlandı.",
      data: {
        fromBalance: result.data.fromBalance,
        toBalance: result.data.toBalance,
        negativeBalanceWarning: result.data.negativeBalanceWarning,
      },
    });
  } catch (error) {
    console.error("CASH_BANK_TRANSFER_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Transfer sırasında bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
