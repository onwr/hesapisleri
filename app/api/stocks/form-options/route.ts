import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getStockFormOptions } from "@/lib/stocks-page-data";
import { getOrCreateDefaultWarehouse } from "@/lib/warehouse-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    await getOrCreateDefaultWarehouse(auth.companyId);

    const data = await getStockFormOptions(auth.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("STOCKS_FORM_OPTIONS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Form seçenekleri yüklenemedi." },
      { status: 500 }
    );
  }
}
