import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import {
  getStocksExportRows,
  parseSearchQuery,
  parseStockTab,
} from "@/lib/stocks-page-data";
import {
  formatMovementQuantityForDisplay,
  formatStockDateTime,
  formatStockMoney,
  getMovementText,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/stocks-page-utils";
import { getTransferStatusLabel } from "@/lib/warehouse-utils";

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
    const tab = parseStockTab(searchParams.get("tab"));
    const q = parseSearchQuery(searchParams.get("q"));
    const { from, to } = normalizeDateRange(
      parseDateParam(searchParams.get("from")) ?? startOfMonth(now),
      parseDateParam(searchParams.get("to")) ?? endOfMonth(now)
    );

    const data = await getStocksExportRows(payload.companyId, {
      tab,
      from,
      to,
      q,
    });

    if (data.mode === "transfers") {
      const header = [
        "Transfer No",
        "Ürün",
        "Çıkış Deposu",
        "Giriş Deposu",
        "Miktar",
        "Durum",
        "Not",
        "Tarih",
      ];

      const rows = data.transfers.map((row) => [
        row.transferNo,
        row.productName,
        row.fromWarehouseName,
        row.toWarehouseName,
        String(row.quantity),
        getTransferStatusLabel(row.status),
        row.note ?? "",
        formatStockDateTime(row.createdAt),
      ]);

      const csv = [header, ...rows]
        .map((line) => line.map(escapeCsvValue).join(","))
        .join("\n");

      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="depo-transferleri-${from.toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (data.mode === "movements") {
      const header = [
        "Ürün",
        "Kategori",
        "Depo",
        "Hareket",
        "Miktar",
        "Not",
        "Tarih",
      ];

      const rows = data.movements.map((row) => [
        row.productName,
        row.categoryName,
        row.warehouseName ?? "",
        getMovementText(row.type),
        formatMovementQuantityForDisplay(row.type, row.quantity),
        row.note ?? "",
        formatStockDateTime(row.createdAt),
      ]);

      const csv = [header, ...rows]
        .map((line) => line.map(escapeCsvValue).join(","))
        .join("\n");

      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="stok-hareketleri-${from.toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const distributionMap = new Map(
      data.warehouseDistribution.map((entry) => [
        entry.productId,
        entry.warehouses.map((w) => `${w.name}: ${w.quantity}`).join(" | "),
      ])
    );

    const header = [
      "Ürün Adı",
      "Stok Kodu",
      "Kategori",
      "Mevcut Stok",
      "Depo Dağılımı",
      "Kritik Seviye",
      "Stok Değeri",
      "Durum",
    ];

    const rows = data.products.map((row) => [
      row.name,
      row.sku,
      row.categoryName,
      `${row.stock} adet`,
      distributionMap.get(row.id) ?? "",
      `${row.criticalLevel} adet`,
      formatStockMoney(row.stockValue),
      row.statusLabel,
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map(escapeCsvValue).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="stoklar-${from.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
