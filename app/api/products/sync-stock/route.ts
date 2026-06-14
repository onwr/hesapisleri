import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { syncAllProductStocksForCompany } from "@/lib/product-stock-sync-service";

function canSyncProductStocks(role: string, isOwner: boolean) {
  return isOwner || role === "OWNER" || role === "ADMIN";
}

export async function POST() {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const { companyId, session } = auth;

    if (!canSyncProductStocks(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        {
          success: false,
          message: "Stok senkronizasyonu için yönetici yetkisi gerekir.",
        },
        { status: 403 }
      );
    }

    const result = await syncAllProductStocksForCompany(companyId);

    return NextResponse.json({
      success: true,
      updated: result.updated,
      unchanged: result.unchanged,
      backfilled: result.backfilled,
      message: `${result.updated} ürün güncellendi, ${result.unchanged} ürün zaten güncel.`,
    });
  } catch (error) {
    console.error("PRODUCT_SYNC_STOCK_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Stok senkronizasyonu sırasında bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
