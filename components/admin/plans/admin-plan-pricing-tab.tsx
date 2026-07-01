"use client";

import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMoney } from "@/lib/format-utils";
import type { AdminPlanPriceWizardInitial } from "@/components/admin/plans/admin-plan-price-wizard";

export type PriceRow = {
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
  group?: string;
};

type PricingData = {
  groups: {
    effective: PriceRow[];
    scheduled: PriceRow[];
    historical: PriceRow[];
    draft: PriceRow[];
  };
  all?: PriceRow[];
};

const GROUP_LABELS: Record<string, string> = {
  effective: "Efektif",
  scheduled: "Zamanlanmış",
  historical: "Geçmiş",
  draft: "Taslak",
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

function flattenRows(data: PricingData | null | undefined): PriceRow[] {
  if (!data?.groups) return [];
  if (data.all && data.all.length > 0) return data.all;
  return [
    ...data.groups.effective,
    ...data.groups.scheduled,
    ...data.groups.historical,
    ...data.groups.draft,
  ];
}

function canEditDraft(row: PriceRow) {
  return row.status === "DRAFT" || row.status === "SCHEDULED";
}

function canRevise(row: PriceRow) {
  return row.status === "ACTIVE" || row.status === "EXPIRED" || row.group === "effective";
}

export function toWizardInitial(row: PriceRow): AdminPlanPriceWizardInitial {
  return {
    id: row.id,
    billingInterval: row.billingInterval,
    currency: row.currency,
    listPrice: row.listPrice,
    salePrice: row.salePrice,
    vatRate: row.vatRate,
    vatIncluded: row.vatIncluded,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    priceChangePolicy: row.priceChangePolicy,
    isPublic: row.isPublic,
    status: row.status,
  };
}

export function AdminPlanPricingTab({
  data,
  planId,
  onCreatePrice,
  onEditPrice,
  onPublishPrice,
  publishingPriceId,
}: {
  data: PricingData | null | undefined;
  planId: string;
  onCreatePrice: () => void;
  onEditPrice: (row: PriceRow, mode: "edit-draft" | "revise") => void;
  onPublishPrice: (row: PriceRow) => void;
  publishingPriceId?: string | null;
}) {
  const rows = flattenRows(data);

  return (
    <div className={`${appPanelClass} p-4`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">Fiyat versiyonları</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Taslak fiyatlar düzenlenebilir. Aktif fiyatlar için yeni versiyon oluşturun.
          </p>
        </div>
        <button type="button" className={appPrimaryButtonClass} onClick={onCreatePrice}>
          Yeni fiyat oluştur
        </button>
      </div>

      {!data?.groups ? (
        <p className="mb-3 text-[12px] text-amber-700">
          Fiyat verisi yüklenemedi. Sayfayı yenileyin veya sekmeyi tekrar seçin.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz fiyat kaydı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Grup</th>
                <th className="px-2 py-2">v</th>
                <th className="px-2 py-2">Dönem</th>
                <th className="px-2 py-2">PB</th>
                <th className="px-2 py-2">Liste</th>
                <th className="px-2 py-2">Satış</th>
                <th className="px-2 py-2">KDV</th>
                <th className="px-2 py-2">Durum</th>
                <th className="px-2 py-2">Yaşam döngüsü</th>
                <th className="px-2 py-2">Başlangıç</th>
                <th className="px-2 py-2">Bitiş</th>
                <th className="px-2 py-2">Kilit</th>
                <th className="px-2 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={appTableRowClass}>
                  <td className="px-2 py-2 text-[11px] text-slate-600">
                    {GROUP_LABELS[row.group ?? ""] ?? row.group ?? "—"}
                  </td>
                  <td className="px-2 py-2">{row.version}</td>
                  <td className="px-2 py-2">
                    {INTERVAL_LABELS[row.billingInterval] ?? row.billingInterval}
                  </td>
                  <td className="px-2 py-2">{row.currency}</td>
                  <td className="px-2 py-2">{formatMoney(row.listPrice)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900">
                    {formatMoney(row.salePrice)}
                  </td>
                  <td className="px-2 py-2 text-[11px]">
                    {row.vatRate}% {row.vatIncluded ? "dahil" : "hariç"}
                  </td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2 text-[11px]">{row.lifecycleLabel}</td>
                  <td className="px-2 py-2 text-[11px]">
                    {formatAdminDate(row.effectiveFrom)}
                  </td>
                  <td className="px-2 py-2 text-[11px]">
                    {row.effectiveUntil ? formatAdminDate(row.effectiveUntil) : "açık uç"}
                  </td>
                  <td className="px-2 py-2">{row.lockedSubscriptionCount}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {canEditDraft(row) ? (
                        <>
                          <button
                            type="button"
                            className={appOutlineButtonClass}
                            onClick={() => onEditPrice(row, "edit-draft")}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className={appOutlineButtonClass}
                            disabled={publishingPriceId === row.id}
                            onClick={() => onPublishPrice(row)}
                          >
                            {publishingPriceId === row.id ? "…" : "Yayınla"}
                          </button>
                        </>
                      ) : null}
                      {canRevise(row) ? (
                        <button
                          type="button"
                          className={appOutlineButtonClass}
                          onClick={() => onEditPrice(row, "revise")}
                        >
                          Yeni versiyon
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
