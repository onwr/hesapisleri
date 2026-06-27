"use client";

import { appOutlineButtonClass, appPanelClass, appTableClass, appTableHeadClass, appTableRowClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMoney } from "@/lib/format-utils";

type PriceRow = {
  id: string;
  version: number;
  billingInterval: string;
  currency: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  vatIncluded: boolean;
  status: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  priceChangePolicy: string;
  isPublic: boolean;
  lockedSubscriptionCount: number;
  nextRenewalSubscriptionCount: number;
  lifecycleLabel: string;
};

type PricingData = {
  groups: {
    effective: PriceRow[];
    scheduled: PriceRow[];
    historical: PriceRow[];
    draft: PriceRow[];
  };
};

function PriceTable({ rows, title }: { rows: PriceRow[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <h4 className="mb-2 text-[12px] font-bold text-slate-800">{title}</h4>
      <div className="overflow-x-auto">
        <table className={appTableClass}>
          <thead>
            <tr className={appTableHeadClass}>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">v</th>
              <th className="px-2 py-2">Dönem</th>
              <th className="px-2 py-2">PB</th>
              <th className="px-2 py-2">Liste</th>
              <th className="px-2 py-2">Satış</th>
              <th className="px-2 py-2">KDV</th>
              <th className="px-2 py-2">Durum</th>
              <th className="px-2 py-2">Yaşam döngüsü</th>
              <th className="px-2 py-2">Politika</th>
              <th className="px-2 py-2">Kilit</th>
              <th className="px-2 py-2">Yenileme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={appTableRowClass}>
                <td className="px-2 py-2 font-mono text-[10px]">{r.id.slice(0, 8)}…</td>
                <td className="px-2 py-2">{r.version}</td>
                <td className="px-2 py-2">{r.billingInterval}</td>
                <td className="px-2 py-2">{r.currency}</td>
                <td className="px-2 py-2">{formatMoney(r.listPrice)}</td>
                <td className="px-2 py-2">{formatMoney(r.salePrice)}</td>
                <td className="px-2 py-2 text-[11px]">
                  {r.vatRate}% {r.vatIncluded ? "dahil" : "hariç"}
                </td>
                <td className="px-2 py-2">{r.status}</td>
                <td className="px-2 py-2 text-[11px]">{r.lifecycleLabel}</td>
                <td className="px-2 py-2 text-[10px]">{r.priceChangePolicy}</td>
                <td className="px-2 py-2">{r.lockedSubscriptionCount}</td>
                <td className="px-2 py-2">{r.nextRenewalSubscriptionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        {rows[0]?.effectiveFrom ? formatAdminDate(rows[0].effectiveFrom) : ""} —{" "}
        {rows[0]?.effectiveUntil ? formatAdminDate(rows[0].effectiveUntil) : "açık uç"}
      </p>
    </div>
  );
}

export function AdminPlanPricingTab({
  data,
  planId,
  onCreatePrice,
}: {
  data: PricingData;
  planId: string;
  onCreatePrice: () => void;
}) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-slate-900">Fiyat versiyonları</h3>
        <button type="button" className={appOutlineButtonClass} onClick={onCreatePrice}>
          Yeni fiyat oluştur
        </button>
      </div>
      <PriceTable rows={data.groups.effective} title="Güncel efektif fiyatlar" />
      <PriceTable rows={data.groups.scheduled} title="Gelecekte başlayacak" />
      <PriceTable rows={data.groups.historical} title="Geçmiş / süresi dolmuş" />
      <PriceTable rows={data.groups.draft} title="Taslak / arşiv" />
      {data.groups.effective.length === 0 &&
      data.groups.scheduled.length === 0 &&
      data.groups.historical.length === 0 &&
      data.groups.draft.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz fiyat kaydı yok.</p>
      ) : null}
    </div>
  );
}
