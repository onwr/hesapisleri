import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import {
  getInvoicesExportRows,
  parseInvoiceTab,
  parseSearchQuery,
} from "@/lib/invoices-page-data";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getPaymentText,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/invoices-page-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const tab = parseInvoiceTab(searchParams.get("tab"));
    const q = parseSearchQuery(searchParams.get("q"));
    const { from, to } = normalizeDateRange(
      parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
    );

    const rows = await getInvoicesExportRows(payload.companyId, {
      tab,
      from,
      to,
      q,
    });

    const header = [
      "Fatura No",
      "Müşteri",
      "Fatura Tarihi",
      "Vade Tarihi",
      "Tutar",
      "Tahsilat Durumu",
      "Fatura Durumu",
    ];

    const csvRows = rows.map((row) => [
      row.invoiceNo,
      row.customerName,
      formatInvoiceDate(row.issueDate),
      formatInvoiceDate(row.dueDate),
      formatInvoiceMoney(row.amount),
      getPaymentText(row.paymentStatus),
      row.invoiceStatus,
    ]);

    const csv = [header, ...csvRows]
      .map((line) => line.map(escapeCsvValue).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="faturalar-${from.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
