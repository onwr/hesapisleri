"use client";

import Link from "next/link";
import { Boxes, Eye } from "lucide-react";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseBadge } from "@/components/warehouses/warehouses-shared";
import { isLowStock, resolveProductMinStock } from "@/lib/stocks-page-utils";

export type WarehouseStockRow = {
  productId: string;
  productName: string;
  sku: string | null;
  categoryName: string;
  warehouseStock: number;
  totalStock: number;
  minStock: number;
  stockMovementHref: string;
};

function stockStatus(row: WarehouseStockRow) {
  if (row.warehouseStock < 0) {
    return { label: "Negatif", tone: "rose" as const };
  }
  if (row.warehouseStock === 0) {
    return { label: "Stoksuz", tone: "slate" as const };
  }
  if (isLowStock(row.warehouseStock, resolveProductMinStock(row.minStock))) {
    return { label: "Düşük Stok", tone: "amber" as const };
  }
  return { label: "Normal", tone: "emerald" as const };
}

export function WarehouseStocksTab({ rows }: { rows: WarehouseStockRow[] }) {
  if (rows.length === 0) {
    return (
      <section className={`${PRODUCT_CARD_CLASS} p-6 text-center text-[13px] text-slate-500`}>
        Bu depoda görüntülenecek stok kaydı bulunmuyor.
      </section>
    );
  }

  return (
    <>
      <section className={`hidden overflow-x-auto md:block ${PRODUCT_CARD_CLASS}`}>
        <table className="w-full min-w-[880px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
              <th className="px-3 py-2.5">Ürün</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">Mevcut Stok</th>
              <th className="px-3 py-2.5">Min. Stok</th>
              <th className="px-3 py-2.5">Durum</th>
              <th className="px-3 py-2.5 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const status = stockStatus(row);
              return (
                <tr key={row.productId} className="font-semibold text-[#24345f]">
                  <td className="px-3 py-2.5">
                    <p className="font-black text-[#0f1f4d]">{row.productName}</p>
                    <p className="text-[11px] text-slate-500">{row.categoryName}</p>
                  </td>
                  <td className="px-3 py-2.5">{row.sku || "—"}</td>
                  <td className="px-3 py-2.5 font-black">{row.warehouseStock}</td>
                  <td className="px-3 py-2.5">{row.minStock}</td>
                  <td className="px-3 py-2.5">
                    <WarehouseBadge tone={status.tone}>{status.label}</WarehouseBadge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/products/${row.productId}`}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-black"
                      >
                        <Eye size={12} className="mr-1 inline" />
                        Ürün
                      </Link>
                      <Link
                        href={row.stockMovementHref}
                        className="rounded-lg border border-orange-100 bg-orange-50 px-2 py-1 text-[11px] font-black text-orange-600"
                      >
                        <Boxes size={12} className="mr-1 inline" />
                        Hareket
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 md:hidden">
        {rows.map((row) => {
          const status = stockStatus(row);
          return (
            <article key={row.productId} className={`${PRODUCT_CARD_CLASS} p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-black text-[#0f1f4d]">{row.productName}</p>
                  <p className="text-[11px] text-slate-500">{row.sku || "SKU yok"}</p>
                </div>
                <WarehouseBadge tone={status.tone}>{status.label}</WarehouseBadge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-semibold text-slate-600">
                <p>Stok: {row.warehouseStock}</p>
                <p>Min: {row.minStock}</p>
              </div>
              <div className="mt-2.5 flex gap-2">
                <Link
                  href={row.stockMovementHref}
                  className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-[#0f1f4d] text-[11px] font-black text-white"
                >
                  Stok Hareketi
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
