import { NextResponse } from "next/server";
import {
  requireApiModuleAccess,
  requireApiSupplierManage,
} from "@/lib/module-access";
import { getSuppliers, createSupplier, SupplierServiceError } from "@/lib/supplier-service";
import { parseSupplierBalanceStatus, parseSupplierSort } from "@/lib/supplier-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const rows = await getSuppliers({
      companyId: auth.companyId,
      search: searchParams.get("q"),
      category: searchParams.get("category"),
      isActive:
        searchParams.get("status") === "active"
          ? true
          : searchParams.get("status") === "passive"
            ? false
            : null,
      isFavorite: searchParams.get("favorite") === "1" ? true : null,
      balanceStatus: parseSupplierBalanceStatus(searchParams.get("balance")),
      sort: parseSupplierSort(searchParams.get("sort")),
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("SUPPLIERS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçiler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const result = await createSupplier({
      companyId: auth.companyId,
      userId: auth.userId,
      data: body,
    });

    return NextResponse.json({
      success: true,
      message: "Tedarikçi oluşturuldu.",
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
    console.error("SUPPLIERS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tedarikçi oluşturulamadı." },
      { status: 500 }
    );
  }
}
