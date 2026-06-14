"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  RefreshCcw,
  Settings2,
  ShieldOff,
  Tags,
  Wifi,
} from "lucide-react";
import type { IntegrationSummary } from "@/lib/marketplace/marketplace-integration-service";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import { IntegrationConfigModal } from "@/components/settings/integrations/integration-config-modal";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";
import {
  CHANNEL_UI_CONFIG,
  getStatusBadge,
} from "@/components/settings/integrations/integration-ui-config";
import {
  SyncResultModal,
  type SyncResultData,
} from "@/components/settings/integrations/sync-result-modal";
import {
  ProductMappingImportResultModal,
  type ProductMappingImportResultData,
} from "@/components/settings/integrations/product-mapping-import-result-modal";

type MarketplaceIntegrationCardProps = {
  channel: MarketplaceChannelKey;
  integration: IntegrationSummary | null;
  warehouses: Array<{ id: string; name: string }>;
  onRefetch: () => Promise<void>;
};

type LoadingAction = "test" | "sync" | "importMappings" | "disconnect" | null;

export function MarketplaceIntegrationCard({
  channel,
  integration,
  warehouses,
  onRefetch,
}: MarketplaceIntegrationCardProps) {
  const config = CHANNEL_UI_CONFIG[channel];
  const status = getStatusBadge(integration?.status);
  const isConnected = integration?.status === "CONNECTED";
  const hasCredentials = integration?.hasCredentials ?? false;
  const supportsProductMappingImport = config.supportsProductMappingImport;

  const [configOpen, setConfigOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResultData | null>(null);
  const [importResult, setImportResult] =
    useState<ProductMappingImportResultData | null>(null);

  useEffect(() => {
    if (!message && !error) return;
    const timer = window.setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  async function testConnection() {
    if (!hasCredentials) {
      setError("Önce bağlantı bilgilerini yapılandırın.");
      return;
    }
    setLoadingAction("test");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/integrations/${channel}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undefined),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? result.message ?? "Bağlantı testi başarısız.");
      }
      setMessage(result.message);
      await onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı testi başarısız.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function syncNow() {
    if (!isConnected) {
      setError("Senkronizasyon için önce bağlantıyı doğrulayın.");
      return;
    }
    setLoadingAction("sync");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/integrations/${channel}/sync`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Senkronizasyon başarısız.");
      }
      setSyncResult({
        fetchedCount: result.data?.fetchedCount ?? 0,
        createdCount: result.data?.createdCount ?? 0,
        updatedCount: result.data?.updatedCount ?? 0,
        skippedCount: result.data?.skippedCount ?? 0,
        errors: Array.isArray(result.data?.errors) ? result.data.errors : [],
      });
      await onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senkronizasyon başarısız.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function importProductMappings() {
    if (!isConnected) {
      setError("SKU eşleme importu için önce bağlantıyı doğrulayın.");
      return;
    }
    if (!supportsProductMappingImport) {
      setError("Bu kanal için ürün eşleme importu henüz desteklenmiyor.");
      return;
    }

    setLoadingAction("importMappings");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/integrations/${channel}/import-product-mappings`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "SKU eşleme importu başarısız.");
      }
      setImportResult({
        fetched: result.fetched ?? 0,
        mapped: result.mapped ?? 0,
        alreadyMapped: result.alreadyMapped ?? 0,
        unmatched: result.unmatched ?? 0,
        skipped: result.skipped ?? 0,
        conflicts: result.conflicts ?? 0,
        items: {
          mapped: Array.isArray(result.items?.mapped) ? result.items.mapped : [],
          unmatched: Array.isArray(result.items?.unmatched)
            ? result.items.unmatched
            : [],
          conflicts: Array.isArray(result.items?.conflicts)
            ? result.items.conflicts
            : [],
          skipped: Array.isArray(result.items?.skipped) ? result.items.skipped : [],
        },
        errors: Array.isArray(result.errors) ? result.errors : undefined,
      });
      await onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "SKU eşleme importu başarısız.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function disconnect() {
    setLoadingAction("disconnect");
    setError(null);
    try {
      const response = await fetch(`/api/integrations/${channel}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Bağlantı kesilemedi.");
      }
      setMessage(config.disconnectMessage);
      setDisconnectOpen(false);
      await onRefetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı kesilemedi.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <section
        className={[
          "group rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)]",
          config.accentBorder,
          config.accentBg,
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IntegrationChannelLogo channel={channel} size="md" />
            <div>
              <h2 className="text-lg font-black text-slate-950">{config.title}</h2>
              <p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">
                {config.description}
              </p>
            </div>
          </div>
          <span
            className={[
              "rounded-full px-3 py-1 text-[11px] font-black",
              status.className,
            ].join(" ")}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Metric label="Bağlantı" value={status.label} />
          <Metric
            label="Son Senkronizasyon"
            value={
              integration?.lastSyncAt
                ? new Date(integration.lastSyncAt).toLocaleString("tr-TR")
                : "—"
            }
          />
          <Metric label="Son Durum" value={integration?.lastSyncStatus ?? "—"} />
          <Metric
            label="Varsayılan Depo"
            value={integration?.defaultWarehouseName ?? "Seçilmedi"}
          />
          <Metric
            label="Otomatik Sync"
            value={integration?.syncEnabled ? `Açık (${integration.autoSyncIntervalMinutes} dk)` : "Kapalı"}
          />
          <Metric
            label="Son Hata"
            value={
              integration?.lastError
                ? integration.lastError.length > 48
                  ? `${integration.lastError.slice(0, 48)}…`
                  : integration.lastError
                : "Yok"
            }
            muted={!integration?.lastError}
          />
        </div>

        {integration?.lastError && integration?.status === "ERROR" ? (
          <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {integration.lastError} — Yapılandır’dan API Key ve Secret alanlarını yeniden
            girin.
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white"
          >
            <Settings2 size={14} />
            Yapılandır
          </button>
          <button
            type="button"
            onClick={syncNow}
            disabled={!isConnected || loadingAction === "sync"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "sync" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Şimdi Çek
          </button>
          <button
            type="button"
            onClick={importProductMappings}
            disabled={
              !isConnected ||
              !supportsProductMappingImport ||
              loadingAction === "importMappings"
            }
            title={
              supportsProductMappingImport
                ? "Pazaryeri listinglerinden SKU eşlemesi oluştur"
                : "Bu kanal için yakında"
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "importMappings" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Tags size={14} />
            )}
            {supportsProductMappingImport
              ? "SKU Eşlemelerini İçe Aktar"
              : "SKU Import (Yakında)"}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={loadingAction === "test"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
          >
            {loadingAction === "test" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wifi size={14} />
            )}
            Test Et
          </button>
          <Link
            href={config.ordersHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
          >
            <ExternalLink size={14} />
            {config.ordersLabel}
          </Link>
          <button
            type="button"
            onClick={() => setDisconnectOpen(true)}
            disabled={!hasCredentials || loadingAction === "disconnect"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-600 sm:col-span-2"
          >
            {loadingAction === "disconnect" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ShieldOff size={14} />
            )}
            Bağlantıyı Kes
          </button>
        </div>
      </section>

      <IntegrationConfigModal
        channel={channel}
        integration={integration}
        warehouses={warehouses}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={onRefetch}
      />

      <SyncResultModal
        channel={channel}
        result={syncResult}
        onClose={() => setSyncResult(null)}
      />

      <ProductMappingImportResultModal
        channel={channel}
        result={importResult}
        onClose={() => setImportResult(null)}
      />

      {disconnectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-black text-slate-950">Bağlantıyı Kes</h4>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bu bağlantıyı kesmek istediğinizden emin misiniz? Kayıtlı credential
              bilgileri silinir.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisconnectOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-xs font-black text-white"
              >
                Bağlantıyı Kes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 truncate text-sm font-black",
          muted ? "text-slate-500" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
