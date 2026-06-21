import { NextResponse } from "next/server";
import { requireAnyApiModuleAccess } from "@/lib/module-access";
import { getSupplierOptions } from "@/lib/supplier-service";

export async function GET() {
  try {
    const auth = await requireAnyApiModuleAccess([
      "suppliers",
      "expenses",
      "products",
      "stocks",
    ]);
    if ("error" in auth) return auth.error;

    const data = await getSupplierOptions(auth.companyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("SUPPLIER_OPTIONS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi seçenekleri yüklenemedi." },
      { status: 500 }
    );
  }
}
