import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  generateUniqueProductBarcode,
  generateUniqueProductIdentifiers,
  generateUniqueProductSku,
} from "@/lib/product-service";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const field = new URL(request.url).searchParams.get("field");

    if (field === "sku") {
      const sku = await generateUniqueProductSku(auth.companyId);
      return NextResponse.json({
        success: true,
        data: { sku },
      });
    }

    if (field === "barcode") {
      const barcode = await generateUniqueProductBarcode(auth.companyId);
      return NextResponse.json({
        success: true,
        data: { barcode },
      });
    }

    const identifiers = await generateUniqueProductIdentifiers(auth.companyId);

    return NextResponse.json({
      success: true,
      data: identifiers,
    });
  } catch (error) {
    console.error("GENERATE_PRODUCT_IDENTIFIERS_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "SKU ve barkod oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
