import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getReportsPageData } from "@/lib/reports-page-data";
import {
  formatReportMoney,
  normalizeDateRange,
  parseDateParam,
  parseReportTab,
  parseReportView,
} from "@/lib/reports-page-utils";

function escapeCsv(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("reports");
  if ("error" in auth) return auth.error;

  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const activeTab = parseReportTab(searchParams.get("tab"));
  const activeReport = parseReportView(searchParams.get("report"));
  const { from, to } = normalizeDateRange(
    parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
    parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
  );

  const data = await getReportsPageData(companyId, {
    tab: activeReport ? "all" : activeTab,
    from,
    to,
  });

  const lines = [
    ["Metrik", "Değer"].map(escapeCsv).join(","),
    ["Toplam Gelir", formatReportMoney(data.totalIncome)].map(escapeCsv).join(","),
    ["Satış Tahsilatı", formatReportMoney(data.financeBreakdown.saleCollectionIncome)].map(escapeCsv).join(","),
    ["Manuel Gelir", formatReportMoney(data.financeBreakdown.manualIncome)].map(escapeCsv).join(","),
    ["Toplam Gider", formatReportMoney(data.totalExpenses)].map(escapeCsv).join(","),
    ["Kayıtlı Gider", formatReportMoney(data.financeBreakdown.recordedExpenseTotal)].map(escapeCsv).join(","),
    ["Kasa/Banka Çıkış", formatReportMoney(data.financeBreakdown.manualCashExpense)].map(escapeCsv).join(","),
    ["Satış İptali", formatReportMoney(data.financeBreakdown.saleCancelExpense)].map(escapeCsv).join(","),
    ["Transfer Giriş", formatReportMoney(data.financeBreakdown.transferInTotal)].map(escapeCsv).join(","),
    ["Transfer Çıkış", formatReportMoney(data.financeBreakdown.transferOutTotal)].map(escapeCsv).join(","),
    ["Net Nakit Akışı", formatReportMoney(data.netProfit)].map(escapeCsv).join(","),
    ["Satış Cirosu", formatReportMoney(data.totalSales)].map(escapeCsv).join(","),
    ...data.summaryItems.map((item) =>
      [item.label, formatReportMoney(item.value)].map(escapeCsv).join(",")
    ),
    "",
    ["Ürün", "Satış Adedi", "Ciro"].map(escapeCsv).join(","),
    ...data.topProducts.map((item) =>
      [item.name, item.soldQty, formatReportMoney(item.revenue)]
        .map(escapeCsv)
        .join(",")
    ),
  ];

  const csv = `\uFEFF${lines.join("\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapor-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
