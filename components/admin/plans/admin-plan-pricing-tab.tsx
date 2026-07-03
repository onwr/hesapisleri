"use client";

import { useState } from "react";
import { AdminPlanInfoTip } from "@/components/admin/plans/admin-plan-info-tip";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { getPricePolicyLabel, getPriceStatusLabel } from "@/lib/admin/plans/admin-plan-price-policy-labels";
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
  createdByUserId?: string | null;
  createdAt?: string;
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

function canCancel(row: PriceRow) {
  return row.status === "DRAFT" || row.status === "SCHEDULED";
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
  onCancelPrice,
  publishingPriceId,
  cancellingPriceId,
}: {
  data: PricingData | null | undefined;
  planId: string;
  onCreatePrice: () => void;
  onEditPrice: (row: PriceRow, mode: "edit-draft" | "revise") => void;
  onPublishPrice: (row: PriceRow) => void;
  onCancelPrice?: (row: PriceRow, reason: string) => void;
  publishingPriceId?: string | null;
  cancellingPriceId?: string | null;
}) {
  const rows = flattenRows(data);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PriceRow | null>(null);

  async function confirmCancel() {
    if (!cancelTarget || !onCancelPrice || !cancelReason.trim()) return;
    onCancelPrice(cancelTarget, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason("");
  }

  return (
    <div className={`${appPanelClass} p-4`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">
            Fiyat geçmişi
            <AdminPlanInfoTip
              text="Her fiyat değişikliği ayrı kayıt olarak saklanır. Eski faturalar eski fiyatını korur."
              className="ml-1"
            />
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Aktif fiyat doğrudan düzenlenemez; değişiklik için Fiyatı Değiştir akışını kullanın.
          </p>
        </div>
        <button type="button" className={`${appPrimaryButtonClass} h-9`} onClick={onCreatePrice}>
          Yeni fiyat
        </button>
      </div>

      {!data?.groups ? (
        <p className="mb-3 text-[12px] text-amber-700">
          Fiyat verisi yüklenemedi. Sayfayı yenileyin veya sekmeyi tekrar seçin.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-500">
          Bu plan için henüz fiyat değişikliği yapılmadı.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Dönem</th>
                <th className="px-2 py-2">Aylık / satış</th>
                <th className="px-2 py-2">Yıllık eşdeğer</th>
                <th className="px-2 py-2">Başlangıç</th>
                <th className="px-2 py-2">Bitiş</th>
                <th className="px-2 py-2">Politika</th>
                <th className="px-2 py-2">Durum</th>
                <th className="px-2 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={appTableRowClass}>
                  <td className="px-2 py-2">
                    {INTERVAL_LABELS[row.billingInterval] ?? row.billingInterval} · v{row.version}
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-900">
                    {formatMoney(row.salePrice)} {row.currency}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-slate-600">
                    {row.billingInterval === "YEARLY"
                      ? formatMoney(row.salePrice)
                      : row.billingInterval === "MONTHLY"
                        ? formatMoney(row.salePrice * 12)
                        : "—"}
                  </td>
                  <td className="px-2 py-2 text-[11px]">{formatAdminDate(row.effectiveFrom)}</td>
                  <td className="px-2 py-2 text-[11px]">
                    {row.effectiveUntil ? formatAdminDate(row.effectiveUntil) : "—"}
                  </td>
                  <td className="px-2 py-2 text-[11px]">
                    {getPricePolicyLabel(row.priceChangePolicy)}
                  </td>
                  <td className="px-2 py-2 text-[11px]">{getPriceStatusLabel(row.status)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {canEditDraft(row) ? (
                        <>
                          <button
                            type="button"
                            className={`${appOutlineButtonClass} h-8`}
                            onClick={() => onEditPrice(row, "edit-draft")}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className={`${appOutlineButtonClass} h-8`}
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
                          className={`${appOutlineButtonClass} h-8`}
                          onClick={() => onEditPrice(row, "revise")}
                        >
                          Fiyatı Değiştir
                        </button>
                      ) : null}
                      {canCancel(row) && onCancelPrice ? (
                        <button
                          type="button"
                          className={`${appOutlineButtonClass} h-8`}
                          disabled={cancellingPriceId === row.id}
                          onClick={() => setCancelTarget(row)}
                        >
                          {cancellingPriceId === row.id ? "…" : "İptal et"}
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

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h4 className="text-[13px] font-bold">Planlanmış fiyatı iptal et</h4>
            <textarea
              className="mt-3 w-full rounded border px-2 py-1.5 text-[12px]"
              rows={2}
              placeholder="İptal sebebi"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className={`${appOutlineButtonClass} h-9`}
                onClick={() => setCancelTarget(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className={`${appOutlineButtonClass} h-9`}
                disabled={!cancelReason.trim()}
                onClick={confirmCancel}
              >
                İptal et
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
