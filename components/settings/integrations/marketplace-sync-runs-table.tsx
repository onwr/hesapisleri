"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import { formatDateTimeDisplay } from "@/lib/format-utils";

type SyncRunRow = {
  id: string;
  channel: string;
  type: string;
  status: string;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: unknown;
  startedAt: string;
  finishedAt: string | null;
};

function statusLabel(status: string) {
  if (status === "SUCCESS") return "Başarılı";
  if (status === "PARTIAL_SUCCESS") return "Kısmi";
  if (status === "RUNNING") return "Çalışıyor";
  return "Hata";
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL_SUCCESS") return "bg-amber-100 text-amber-700";
  if (status === "RUNNING") return "bg-blue-100 text-blue-700";
  return "bg-rose-100 text-rose-700";
}

function channelClass(channel: string) {
  if (channel === "TRENDYOL") return "bg-orange-100 text-orange-700";
  if (channel === "HEPSIBURADA") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

type MarketplaceSyncRunsTableProps = {
  runs: SyncRunRow[];
  onRefresh?: () => Promise<void>;
};

export function MarketplaceSyncRunsTable({
  runs,
  onRefresh,
}: MarketplaceSyncRunsTableProps) {
  const [selectedErrors, setSelectedErrors] = useState<unknown[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const parsedRows = useMemo(
    () =>
      runs.map((run) => ({
        ...run,
        normalizedErrors: Array.isArray(run.errors) ? run.errors : [],
      })),
    [runs]
  );

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-950">Senkronizasyon Geçmişi</h3>
          <p className="mt-1 text-sm text-slate-500">
            Son entegrasyon denemeleri ve sonuçları
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700"
          >
            {refreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Yenile
          </button>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-black text-slate-500">
              <th className="py-2">Tarih</th>
              <th className="py-2">Kanal</th>
              <th className="py-2">Tip</th>
              <th className="py-2">Durum</th>
              <th className="py-2">Metrikler</th>
              <th className="py-2">Hata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parsedRows.length > 0 ? (
              parsedRows.map((run) => (
                <tr key={run.id} className="font-semibold text-slate-700">
                  <td className="whitespace-nowrap py-3">
                    {formatDateTimeDisplay(run.startedAt)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      {run.channel === "TRENDYOL" || run.channel === "HEPSIBURADA" ? (
                        <IntegrationChannelLogo
                          channel={run.channel as MarketplaceChannelKey}
                          size="sm"
                        />
                      ) : null}
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-[10px] font-black",
                          channelClass(run.channel),
                        ].join(" ")}
                      >
                        {run.channel}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      {run.type}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        statusClass(run.status),
                      ].join(" ")}
                    >
                      {statusLabel(run.status)}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <MetricPill label="Fetch" value={run.fetchedCount} />
                      <MetricPill label="Yeni" value={run.createdCount} />
                      <MetricPill label="Güncel" value={run.updatedCount} />
                      <MetricPill label="Skip" value={run.skippedCount} />
                    </div>
                  </td>
                  <td className="py-3">
                    {run.normalizedErrors.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedErrors(run.normalizedErrors)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-50"
                      >
                        Hataları Gör ({run.normalizedErrors.length})
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-14 text-center">
                  <p className="text-sm font-black text-slate-700">
                    Henüz senkronizasyon yapılmadı
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    İlk siparişleri çekmek için entegrasyon kartından Şimdi Çek
                    butonunu kullanın.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedErrors ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-[1.75rem] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">Senkronizasyon Hataları</h4>
              <button
                type="button"
                onClick={() => setSelectedErrors(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600"
              >
                Kapat
              </button>
            </div>
            <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto">
              {selectedErrors.map((item, index) => {
                const row = item as Record<string, unknown>;
                return (
                  <div key={index} className="rounded-xl border border-slate-200 p-3 text-xs">
                    <p className="font-bold text-rose-700">
                      {String(row.message ?? "Bilinmeyen hata")}
                    </p>
                    <p className="mt-1 text-slate-600">
                      externalOrderId: {String(row.externalOrderId ?? "—")}
                    </p>
                    <p className="text-slate-600">
                      merchantSku: {String(row.merchantSku ?? "—")}
                    </p>
                    <p className="text-slate-600">
                      rawStatus: {String(row.rawStatus ?? "—")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
      {label}: {value}
    </span>
  );
}
