import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { recalculateCustomerBalances } from "@/lib/customer-balance-utils";

export async function POST() {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const updatedCount = await db.$transaction(async (tx) =>
      recalculateCustomerBalances(companyId!, tx)
    );

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
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
