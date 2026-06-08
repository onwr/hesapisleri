import { NextResponse } from "next/server";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getMarketplaceName } from "@/lib/marketplace-logos";
import { PAYMENT_STATUS_LABELS } from "@/lib/order-utils";
import {
  getOrdersExportRows,
  parseOrderTab,
  parseSearchQuery,
  parseSourceChannelFilter,
} from "@/lib/orders-page-data";
import {
  formatOrderDateTime,
  formatOrderMoney,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/orders-page-utils";

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const tab = parseOrderTab(searchParams.get("tab"));
    const q = parseSearchQuery(searchParams.get("q"));
    const channel = parseSourceChannelFilter(searchParams.get("channel"));
    const { from, to } = normalizeDateRange(
      parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
    );

    const rows = await getOrdersExportRows(auth.companyId, {
      tab,
      from,
      to,
      q,
      channel,
    });

    const header = [
      "Sipariş No",
      "Satış No",
      "Kanal",
      "Harici Sipariş No",
      "Müşteri",
      "Tutar",
      "Ödeme Durumu",
      "Sipariş Durumu",
      "Kargo Firması",
      "Takip No",
      "Oluşturma Tarihi",
    ];

    const csvRows = rows.map((row) => [
      row.orderNo,
      row.saleNo,
      getMarketplaceName(row.channel),
      row.externalOrderId ?? "",
      row.customerName,
      formatOrderMoney(row.total),
      PAYMENT_STATUS_LABELS[row.paymentStatus],
      row.status,
      row.cargo === "—" ? "" : row.cargo,
      row.cargoCode ?? "",
      formatOrderDateTime(row.createdAt),
    ]);

    const csv = [header, ...csvRows]
      .map((line) => line.map(escapeCsvValue).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="siparisler-${from.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
