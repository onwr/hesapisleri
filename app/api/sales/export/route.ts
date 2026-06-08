import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getSalesExportRows } from "@/lib/sales-page-data";
import {
  formatDateDisplay,
  formatShortDateTime,
  normalizeDateRange,
  parseDateParam,
  parseSalesTab,
} from "@/lib/sales-page-utils";

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

function getPaymentText(status: string) {
  if (status === "PAID") return "Tahsil Edildi";
  if (status === "PARTIAL") return "Kısmi Tahsilat";
  return "Tahsil Edilmedi";
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
    const tab = parseSalesTab(searchParams.get("tab"));
    const saleId = searchParams.get("saleId");
    const invoiceId = searchParams.get("invoiceId");
    const collectionId = searchParams.get("collectionId");
    const { from, to } = normalizeDateRange(
      parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
    );

    const rows = await getSalesExportRows(payload.companyId, {
      tab,
      from,
      to,
      saleId,
      invoiceId,
      collectionId,
    });

    const header = [
      "Belge No",
      "Müşteri",
      "Tarih",
      "Tür",
      "Tutar",
      "Tahsilat Durumu",
      "Durum",
      "Özet",
    ];

    const csvRows = rows.map((row) => [
      row.documentNo,
      row.customerName,
      formatShortDateTime(row.date),
      row.typeLabel,
      new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(row.amount),
      getPaymentText(row.paymentStatus),
      row.status,
      row.itemSummary,
    ]);

    const csv = [header, ...csvRows]
      .map((line) => line.map((value) => escapeCsvValue(String(value))).join(","))
      .join("\n");

    const suffix = saleId || invoiceId || collectionId ? "belge" : "liste";
    const filename = `satis-${suffix}-${formatDateDisplay(from)}-${formatDateDisplay(to)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("SALES_EXPORT_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Dışa aktarma sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
