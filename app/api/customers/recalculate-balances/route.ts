import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { recalculateCustomerBalances } from "@/lib/customer-balance-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function POST() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const updatedCount = await db.$transaction(async (tx) =>
      recalculateCustomerBalances(payload.companyId!, tx)
    );

    await db.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: "UPDATE",
        module: "customers",
        message: `${updatedCount} müşterinin cari bakiyesi yeniden hesaplandı.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Müşteri bakiyeleri yeniden hesaplandı.",
      data: {
        updatedCount,
      },
    });
  } catch (error) {
    console.error("RECALCULATE_CUSTOMER_BALANCES_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri bakiyeleri yeniden hesaplanamadı.",
      },
      { status: 500 }
    );
  }
}
