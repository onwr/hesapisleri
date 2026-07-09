"use client";

import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseBadge } from "@/components/warehouses/warehouses-shared";
import { formatStockDateTime } from "@/lib/stocks-page-utils";
import {
  getTransferStatusClass,
  getTransferStatusLabel,
} from "@/lib/warehouse-utils";
import { WarehouseTransferRowActions } from "@/components/warehouses/warehouse-transfer-row-actions";

export type WarehouseTransferRow = {
  id: string;
  transferNo: string;
  quantity: number;
  status: string;
  createdAt: string;
  product: { name: string };
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  createdBy?: { name: string | null } | null;
};

export function WarehouseTransfersTab({ transfers }: { transfers: WarehouseTransferRow[] }) {
  if (transfers.length === 0) {
    return (
      <section className={`${PRODUCT_CARD_CLASS} p-6 text-center text-[13px] text-slate-500`}>
        Bu depoya ait transfer kaydı bulunmuyor.
      </section>
    );
  }

  return (
    <>
      <section className={`hidden md:block ${PRODUCT_CARD_CLASS} overflow-x-auto`}>
        <table className="w-full min-w-[900px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
              <th className="px-3 py-2.5">Transfer No</th>
              <th className="px-3 py-2.5">Kaynak → Hedef</th>
              <th className="px-3 py-2.5">Ürün</th>
              <th className="px-3 py-2.5">Miktar</th>
              <th className="px-3 py-2.5">Durum</th>
              <th className="px-3 py-2.5">Tarih</th>
              <th className="px-3 py-2.5">Oluşturan</th>
              <th className="px-3 py-2.5 text-center">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="font-semibold text-[#24345f]">
                <td className="px-3 py-2.5 font-black text-[#0f1f4d]">
                  {transfer.transferNo}
                </td>
                <td className="px-3 py-2.5">
                  {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                </td>
                <td className="px-3 py-2.5">{transfer.product.name}</td>
                <td className="px-3 py-2.5">{transfer.quantity}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={[
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-black",
                      getTransferStatusClass(transfer.status),
                    ].join(" ")}
                  >
                    {getTransferStatusLabel(transfer.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {formatStockDateTime(new Date(transfer.createdAt))}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {transfer.createdBy?.name || "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <WarehouseTransferRowActions
                    transferId={transfer.id}
                    transferNo={transfer.transferNo}
                    status={transfer.status}
                    quantity={transfer.quantity}
                    productName={transfer.product.name}
                    fromWarehouseName={transfer.fromWarehouse.name}
                    toWarehouseName={transfer.toWarehouse.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 md:hidden">
        {transfers.map((transfer) => (
          <article key={transfer.id} className={`${PRODUCT_CARD_CLASS} p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-[#0f1f4d]">{transfer.transferNo}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {formatStockDateTime(new Date(transfer.createdAt))}
                </p>
              </div>
              <WarehouseBadge tone="blue">
                {getTransferStatusLabel(transfer.status)}
              </WarehouseBadge>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-600">
              {transfer.product.name} · {transfer.quantity} adet
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
