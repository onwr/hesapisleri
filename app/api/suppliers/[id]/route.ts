import { NextResponse } from "next/server";
import {
  requireApiModuleAccess,
  requireApiSupplierManage,
} from "@/lib/module-access";
import {
  deleteSupplier,
  getSupplierById,
  SupplierServiceError,
  updateSupplier,
} from "@/lib/supplier-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const supplier = await getSupplierById(auth.companyId, id);

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "Tedarikçi bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    console.error("SUPPLIER_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const result = await updateSupplier({
      companyId: auth.companyId,
      userId: auth.userId,
      supplierId: id,
      data: body,
    });

    return NextResponse.json({
      success: true,
      message: "Tedarikçi güncellendi.",
      data: result.supplier,
      warning: result.taxNumberWarning,
    });
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    await deleteSupplier({
      companyId: auth.companyId,
      userId: auth.userId,
      supplierId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Tedarikçi silindi.",
    });
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi silinemedi." },
      { status: 500 }
    );
  }
}
