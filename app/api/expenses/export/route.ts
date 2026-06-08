import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getPaymentStatusLabel } from "@/lib/expense-utils";
import {
  formatExpenseDate,
  getExpenseDocumentNo,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/expenses-page-utils";
import {
  getExpensesExportRows,
  parseExpenseCategoryFilter,
  parseExpenseTab,
  parseSearchQuery,
} from "@/lib/expenses-page-data";

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function getStatusLabel(status: string) {
  if (status === "PENDING") return "Onay Bekliyor";
  if (status === "CANCELLED") return "İptal";
  return "Onaylandı";
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("expenses");
    if ("error" in auth) return auth.error;

    const { companyId } = auth;

    const { searchParams } = new URL(request.url);
    const tab = parseExpenseTab(searchParams.get("tab"));
    const q = parseSearchQuery(searchParams.get("q"));
    const now = new Date();
    const { from, to } = normalizeDateRange(
      parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
    );

    const category = parseExpenseCategoryFilter(searchParams.get("category"));

    const expenses = await getExpensesExportRows(companyId, {
      tab,
      from,
      to,
      q,
      category,
    });

    const header = [
      "Tarih",
      "Gider Adı",
      "Kategori",
      "Tedarikçi",
      "Belge No",
      "Tutar",
      "Ödeme Durumu",
      "Durum",
    ];

    const rows = expenses.map((expense) => [
      formatExpenseDate(expense.date),
      expense.title,
      expense.category || "Diğer",
      expense.supplier ?? "",
      getExpenseDocumentNo(expense),
      String(Number(expense.amount)),
      expense.status === "CANCELLED"
        ? "İptal"
        : getPaymentStatusLabel(expense.paymentStatus),
      getStatusLabel(expense.status),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="giderler.csv"',
      },
    });
  } catch (error) {
    console.error("EXPENSE_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gider listesi dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
