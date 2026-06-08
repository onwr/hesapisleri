import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getBulkOrderExportRows } from "@/lib/orders-bulk-actions-service";
import { getMarketplaceName } from "@/lib/marketplace-logos";
import {
  formatOrderDateTime,
  formatOrderMoney,
} from "@/lib/orders-page-utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/order-utils";

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
    const ids = (searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "En az bir sipariş seçin." },
        { status: 400 }
      );
    }

    const rows = await getBulkOrderExportRows(auth.companyId, ids);

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
        "Content-Disposition": 'attachment; filename="secili-siparisler.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
