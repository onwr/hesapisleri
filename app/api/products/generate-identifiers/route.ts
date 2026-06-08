import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { generateUniqueProductIdentifiers } from "@/lib/product-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

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
