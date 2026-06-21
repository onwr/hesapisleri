"use client";

import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseBadge } from "@/components/warehouses/warehouses-shared";
import {
  formatStockDateTime,
  getMovementClass,
  getMovementText,
} from "@/lib/stocks-page-utils";

export type WarehouseMovementRow = {
  id: string;
  type: string;
  quantity?: number;
  createdAt: string;
  product: { id: string; name: string };
  user?: { name: string | null } | null;
  note?: string | null;
};

export function WarehouseMovementsTab({ movements }: { movements: WarehouseMovementRow[] }) {
  if (movements.length === 0) {
    return (
      <section className={`${PRODUCT_CARD_CLASS} p-6 text-center text-[13px] text-slate-500`}>
        Bu depoda hareket kaydı bulunmuyor.
      </section>
    );
  }

  return (
    <>
      <section className={`hidden md:block ${PRODUCT_CARD_CLASS} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
              <th className="px-3 py-2.5">Tarih</th>
              <th className="px-3 py-2.5">Ürün</th>
              <th className="px-3 py-2.5">İşlem</th>
              <th className="px-3 py-2.5">Miktar</th>
              <th className="px-3 py-2.5">Açıklama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((movement) => (
              <tr key={movement.id} className="font-semibold text-[#24345f]">
                <td className="px-3 py-2.5 text-slate-500">
                  {formatStockDateTime(new Date(movement.createdAt))}
                </td>
                <td className="px-3 py-2.5 font-black text-[#0f1f4d]">
                  {movement.product.name}
                </td>
                <td className="px-3 py-2.5">
                  <WarehouseBadge tone="blue">{getMovementText(movement.type)}</WarehouseBadge>
                </td>
                <td className="px-3 py-2.5">
                  {movement.quantity != null ? movement.quantity : "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-500">{movement.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 md:hidden">
        {movements.map((movement) => (
          <article key={movement.id} className={`${PRODUCT_CARD_CLASS} p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-[#0f1f4d]">{movement.product.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {formatStockDateTime(new Date(movement.createdAt))}
                </p>
              </div>
              <span
                className={[
                  "rounded px-1.5 py-0.5 text-[10px] font-black",
                  getMovementClass(movement.type),
                ].join(" ")}
              >
                {getMovementText(movement.type)}
              </span>
            </div>
            {movement.note ? (
              <p className="mt-2 text-[11px] text-slate-600">{movement.note}</p>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
