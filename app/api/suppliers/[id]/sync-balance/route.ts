import { NextResponse } from "next/server";
import { requireApiSupplierManage } from "@/lib/module-access";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import { SupplierServiceError } from "@/lib/supplier-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const supplier = await syncSupplierBalance(auth.companyId, id);

    if (!supplier) {
      throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Bakiye senkronize edildi.",
      data: supplier,
    });
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Bakiye senkronize edilemedi." },
      { status: 500 }
    );
  }
}
