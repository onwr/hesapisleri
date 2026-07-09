import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { resolveMonthFinancialPeriod } from "@/lib/finance/financial-period";
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
  const month = resolveMonthFinancialPeriod({ referenceDate: now });
  const { from, to } = normalizeDateRange(
    parseDateParam(searchParams.get("from")) ?? month.from,
    parseDateParam(searchParams.get("to")) ?? month.toInclusive
  );

  const data = await getReportsPageData(companyId, {
    tab: activeReport ? "all" : activeTab,
    from,
    to,
  });

  const lines = [
    ["Metrik", "Değer"].map(escapeCsv).join(","),
    ["Nakit Gelir", formatReportMoney(data.totalIncome)].map(escapeCsv).join(","),
    ["Satış Tahsilatı", formatReportMoney(data.financeBreakdown.saleCollectionIncome)].map(escapeCsv).join(","),
    ["Manuel Gelir", formatReportMoney(data.financeBreakdown.manualIncome)].map(escapeCsv).join(","),
    ["Nakit Gider", formatReportMoney(data.totalExpenses)].map(escapeCsv).join(","),
    ["Kayıtlı Gider (ödenmemiş)", formatReportMoney(data.financeBreakdown.recordedExpenseTotal)].map(escapeCsv).join(","),
    ["Kasa/Banka Çıkış", formatReportMoney(data.financeBreakdown.manualCashExpense)].map(escapeCsv).join(","),
    ["Ters Kayıt / İptal Çıkışı", formatReportMoney(data.financeBreakdown.saleCancelExpense)].map(escapeCsv).join(","),
    ["Transfer Giriş", formatReportMoney(data.financeBreakdown.transferInTotal)].map(escapeCsv).join(","),
    ["Transfer Çıkış", formatReportMoney(data.financeBreakdown.transferOutTotal)].map(escapeCsv).join(","),
    ["Operasyonel Nakit Sonucu", formatReportMoney(data.netProfit)].map(escapeCsv).join(","),
    ["Nakit Etkisi (ters kayıtlı)", formatReportMoney(data.cashNetProfit)].map(escapeCsv).join(","),
    ["Tahakkuk Satış (kayıt oluşturma)", formatReportMoney(data.totalSales)].map(escapeCsv).join(","),
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
