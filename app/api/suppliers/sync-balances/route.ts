import { NextResponse } from "next/server";
import { requireApiSupplierManage } from "@/lib/module-access";
import { syncAllSupplierBalances } from "@/lib/supplier-balance-service";

export async function POST() {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const result = await syncAllSupplierBalances(auth.companyId);

    return NextResponse.json({
      success: true,
      message: "Tedarikçi bakiyeleri senkronize edildi.",
      data: result,
    });
  } catch (error) {
    console.error("SUPPLIERS_SYNC_BALANCES_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bakiyeler senkronize edilemedi." },
      { status: 500 }
    );
  }
}
