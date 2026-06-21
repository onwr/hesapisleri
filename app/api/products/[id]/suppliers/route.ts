import { NextResponse } from "next/server";
import { requireAnyApiModuleAccess } from "@/lib/module-access";
import { getSupplierProductsForProduct } from "@/lib/supplier-product-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireAnyApiModuleAccess(["products", "suppliers"]);
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const data = await getSupplierProductsForProduct(auth.companyId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PRODUCT_SUPPLIERS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi listesi yüklenemedi." },
      { status: 500 }
    );
  }
}
