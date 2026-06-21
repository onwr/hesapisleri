import { NextResponse } from "next/server";
import { requireApiSupplierManage } from "@/lib/module-access";
import {
  removeSupplierProduct,
  SupplierProductServiceError,
  updateSupplierProduct,
} from "@/lib/supplier-product-service";

type Props = { params: Promise<{ id: string; supplierProductId: string }> };

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id, supplierProductId } = await params;
    const body = await req.json();
    const data = await updateSupplierProduct({
      companyId: auth.companyId,
      supplierId: id,
      supplierProductId,
      data: body,
    });

    return NextResponse.json({
      success: true,
      message: "Tedarikçi ürün kaydı güncellendi.",
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
      { success: false, message: "Kayıt güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id, supplierProductId } = await params;
    await removeSupplierProduct({
      companyId: auth.companyId,
      supplierId: id,
      supplierProductId,
    });

    return NextResponse.json({
      success: true,
      message: "Ürün tedarikçiden kaldırıldı.",
    });
  } catch (error) {
    if (error instanceof SupplierProductServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Kayıt silinemedi." },
      { status: 500 }
    );
  }
}
