"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import type { RecentTransferRow } from "@/lib/warehouse-page-data";
import { formatStockNumber } from "@/lib/stocks-page-utils";
import { getTransferStatusLabel } from "@/lib/warehouse-utils";

type WarehousesRecentTransfersProps = {
  transfers: RecentTransferRow[];
};

function formatTransferDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WarehousesRecentTransfers({
  transfers,
}: WarehousesRecentTransfersProps) {
  if (transfers.length === 0) return null;

  return (
    <section className={`${PRODUCT_CARD_CLASS} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-[#0f1f4d]">Son Transferler</h2>
          <p className="text-[11px] font-medium text-slate-500">
            En son tamamlanan depolar arası transferler
          </p>
        </div>
        <Link
          href="/products/stocks"
          className="text-[11px] font-black text-blue-600 hover:underline"
        >
          Tüm hareketler
        </Link>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Transfer No</th>
              <th className="px-4 py-2.5">Kaynak</th>
              <th className="px-4 py-2.5">Hedef</th>
              <th className="px-4 py-2.5">Kalem</th>
              <th className="px-4 py-2.5">Miktar</th>
              <th className="px-4 py-2.5">Tarih</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr
                key={transfer.id}
                className="border-t border-slate-100 transition hover:bg-slate-50/60"
              >
                <td className="px-4 py-3 font-black text-[#0f1f4d]">
                  {transfer.transferNo}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-600">
                  {transfer.fromWarehouseName}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-600">
                  {transfer.toWarehouseName}
                </td>
                <td className="px-4 py-3">{formatStockNumber(transfer.itemCount)}</td>
                <td className="px-4 py-3">{formatStockNumber(transfer.totalQuantity)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {formatTransferDate(transfer.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                    {getTransferStatusLabel(transfer.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href="/products/stocks"
                    className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600"
                  >
                    Görüntüle
                    <ArrowRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 md:hidden">
        {transfers.map((transfer) => (
          <article
            key={transfer.id}
            className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-black text-[#0f1f4d]">
                  {transfer.transferNo}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-600">
                  {transfer.fromWarehouseName} → {transfer.toWarehouseName}
                </p>
              </div>
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-600">
                {getTransferStatusLabel(transfer.status)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-slate-500">
              <span>{formatStockNumber(transfer.itemCount)} kalem</span>
              <span>{formatStockNumber(transfer.totalQuantity)} adet</span>
              <span>{formatTransferDate(transfer.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
