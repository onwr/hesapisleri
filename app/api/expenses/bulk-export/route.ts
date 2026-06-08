import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getPaymentStatusLabel, isCancelledExpense } from "@/lib/expense-utils";
import {
  getBulkExpenseExportRows,
  parseBulkExpenseFilters,
} from "@/lib/expense-bulk-actions-service";
import { formatExpenseDate } from "@/lib/expenses-page-utils";

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function getStatusLabel(status: string) {
  if (status === "CANCELLED") return "İptal";
  return "Aktif";
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    const ids = idsParam
      ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;

    const filters = parseBulkExpenseFilters({
      q: searchParams.get("q"),
      category: searchParams.get("category"),
      paymentStatus: searchParams.get("paymentStatus"),
      status: searchParams.get("status"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const expenses = await getBulkExpenseExportRows(auth.companyId, {
      ids,
      filters: ids ? undefined : filters,
    });

    const header = [
      "Tarih",
      "Başlık",
      "Kategori",
      "Tutar",
      "Ödeme Durumu",
      "Hesap",
      "Not",
      "Durum",
    ];

    const rows = expenses.map((expense) => [
      formatExpenseDate(expense.date),
      expense.title,
      expense.category,
      String(expense.amount),
      isCancelledExpense(expense.status)
        ? "İptal"
        : getPaymentStatusLabel(expense.paymentStatus),
      expense.accountName ?? "",
      expense.note ?? "",
      getStatusLabel(expense.status),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="giderler-secili.csv"',
      },
    });
  } catch (error) {
    console.error("EXPENSE_BULK_EXPORT_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
