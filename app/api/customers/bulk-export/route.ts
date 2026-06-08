import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { buildBulkActionsCsv } from "@/lib/customer-bulk-actions-utils";
import {
  getBulkCustomersExportRows,
  parseBulkFilters,
} from "@/lib/customer-bulk-actions-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function GET(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filters = parseBulkFilters({
      group: searchParams.get("group"),
      status: searchParams.get("status"),
      balanceType: searchParams.get("balanceType"),
      search: searchParams.get("search"),
    });

    const idsParam = searchParams.get("ids");
    const selectedIds = idsParam
      ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;

    const customers = await getBulkCustomersExportRows(
      payload.companyId,
      filters,
      selectedIds
    );

    const csv = buildBulkActionsCsv(customers);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="musteriler-toplu-islem.csv"',
      },
    });
  } catch (error) {
    console.error("GET_CUSTOMER_BULK_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "CSV dışa aktarımı başarısız oldu.",
      },
      { status: 500 }
    );
  }
}
