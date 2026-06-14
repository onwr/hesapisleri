"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";
import { CHANNEL_UI_CONFIG } from "@/components/settings/integrations/integration-ui-config";
import {
  isEmptySyncResult,
  SYNC_METRIC_HINTS,
} from "@/lib/marketplace/sync-result-utils";

export type SyncResultData = {
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: unknown[];
};

type SyncResultModalProps = {
  channel: MarketplaceChannelKey;
  result: SyncResultData | null;
  onClose: () => void;
};

function formatError(item: unknown) {
  const row = item as Record<string, unknown>;
  return String(row.message ?? "Bilinmeyen hata");
}

const METRICS = [
  { key: "fetched" as const, label: "Çekilen", field: "fetchedCount" as const },
  { key: "created" as const, label: "Oluşturulan", field: "createdCount" as const },
  { key: "updated" as const, label: "Güncellenen", field: "updatedCount" as const },
  { key: "skipped" as const, label: "Atlanan", field: "skippedCount" as const },
];

export function SyncResultModal({ channel, result, onClose }: SyncResultModalProps) {
  if (!result) return null;

  const config = CHANNEL_UI_CONFIG[channel];
  const errorItems = Array.isArray(result.errors) ? result.errors : [];
  const hasErrors = errorItems.length > 0;
  const isEmpty = isEmptySyncResult(result);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="relative">
            <IntegrationChannelLogo channel={channel} size="md" className="h-12 w-12" />
            <div
              className={[
                "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white",
                hasErrors
                  ? "bg-amber-100 text-amber-700"
                  : isEmpty
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {hasErrors ? (
                <AlertTriangle size={11} />
              ) : isEmpty ? (
                <Info size={11} />
              ) : (
                <CheckCircle2 size={11} />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {config.title}
            </p>
            <h3 className="text-lg font-black text-slate-950">
              {isEmpty
                ? "Bağlantı başarılı, bu dönemde sipariş bulunamadı"
                : "Senkronizasyon Tamamlandı"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isEmpty
                ? `${config.title} bağlantısı çalışıyor ancak seçilen senkronizasyon aralığında pazaryerinden sipariş dönmedi. Bu durum ürünlerin çekilmediği anlamına gelmez; entegrasyon şu anda ürün kataloğu değil, siparişleri çeker.`
                : "Sipariş çekim özeti aşağıdadır. Detaylı hatalar için geçmiş tablosunu inceleyebilirsiniz."}
            </p>
          </div>
        </div>

        {isEmpty ? (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-950">
            İlk senkronizasyonda son 14 gün içindeki siparişler aranır. Mağazanızda bu
            dönemde sipariş yoksa tüm değerler 0 görünebilir.
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METRICS.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-center"
              title={SYNC_METRIC_HINTS[metric.key]}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {result[metric.field]}
              </p>
              <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                {SYNC_METRIC_HINTS[metric.key]}
              </p>
            </div>
          ))}
        </div>

        {hasErrors ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <p className="text-xs font-black text-rose-700">
              {errorItems.length} hata kaydedildi
            </p>
            <ul className="mt-2 space-y-1.5 text-xs font-semibold text-rose-800">
              {errorItems.slice(0, 3).map((item, index) => (
                <li key={index} className="truncate">
                  • {formatError(item)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-medium text-rose-600">
              Tüm hataları senkronizasyon geçmişinden görüntüleyebilirsiniz.
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
          >
            Kapat
          </button>
          {isEmpty ? (
            <>
              <Link
                href="/orders?tab=matching"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
              >
                Eşleşmeyen SKU&apos;ları Kontrol Et
              </Link>
              <Link
                href={config.mappingHref}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
              >
                SKU Eşlemeye Git
              </Link>
            </>
          ) : null}
          <Link
            href={config.ordersHref}
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-xs font-black text-white"
          >
            Siparişlere Git
          </Link>
        </div>
      </div>
    </div>
  );
}
