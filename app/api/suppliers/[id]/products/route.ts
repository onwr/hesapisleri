import { NextResponse } from "next/server";
import { requireApiModuleAccess, requireApiSupplierManage } from "@/lib/module-access";
import {
  addProductToSupplier,
  getSupplierProductsForSupplier,
  SupplierProductServiceError,
} from "@/lib/supplier-product-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const data = await getSupplierProductsForSupplier(auth.companyId, id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("SUPPLIER_PRODUCTS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi ürünleri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const data = await addProductToSupplier({
      companyId: auth.companyId,
      supplierId: id,
      data: body,
    });

    return NextResponse.json({
      success: true,
      message: "Ürün tedarikçiye eklendi.",
      data,
    });
  } catch (error) {
    if (error instanceof SupplierProductServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ürün eklenemedi." },
      { status: 500 }
    );
  }
}
