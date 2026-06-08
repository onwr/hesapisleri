import { NextResponse } from "next/server";
import { requireAnyApiModuleAccess } from "@/lib/module-access";
import { getWarehouseOptions } from "@/lib/warehouse-options";
import { getOrCreateDefaultWarehouse } from "@/lib/warehouse-service";

export async function GET() {
  try {
    const auth = await requireAnyApiModuleAccess([
      "pos",
      "sales",
      "stocks",
      "products",
    ]);
    if ("error" in auth) return auth.error;

    await getOrCreateDefaultWarehouse(auth.companyId);

    const data = await getWarehouseOptions(auth.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("WAREHOUSE_OPTIONS_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Depo seçenekleri yüklenemedi." },
      { status: 500 }
    );
  }
}
