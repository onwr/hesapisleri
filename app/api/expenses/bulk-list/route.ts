import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getBulkExpenseList,
  parseBulkExpenseFilters,
} from "@/lib/expense-bulk-actions-service";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = parseBulkExpenseFilters({
      q: searchParams.get("q"),
      category: searchParams.get("category"),
      paymentStatus: searchParams.get("paymentStatus"),
      status: searchParams.get("status"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const data = await getBulkExpenseList(auth.companyId, filters);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("EXPENSE_BULK_LIST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Gider listesi alınamadı." },
      { status: 500 }
    );
  }
}
