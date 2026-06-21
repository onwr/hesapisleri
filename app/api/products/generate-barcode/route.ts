import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { generateUniqueProductBarcode } from "@/lib/product-service";

export async function POST() {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const barcode = await generateUniqueProductBarcode(auth.companyId);

    return NextResponse.json({
      success: true,
      barcode,
    });
  } catch (error) {
    console.error("GENERATE_PRODUCT_BARCODE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Barkod oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
