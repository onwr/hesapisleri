"use client";

import { useState } from "react";
import { FileText, Loader2, PlugZap, Settings2, Unplug } from "lucide-react";
import type { EDocumentIntegrationSummary } from "@/lib/e-document/e-document-integration-service";
import { EDocumentConfigModal } from "@/components/settings/integrations/e-document-config-modal";

type Props = {
  integration: EDocumentIntegrationSummary;
  onRefetch: () => Promise<void>;
};

function statusBadge(integration: EDocumentIntegrationSummary) {
  if (integration.status === "CONNECTED" && integration.providerConnectionReady) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (integration.status === "PARTIALLY_CONNECTED") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (integration.status === "ERROR") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (integration.hasCredentials && !integration.providerConnectionReady) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function statusLabel(integration: EDocumentIntegrationSummary) {
  if (integration.status === "CONNECTED" && integration.providerConnectionReady) {
    return "Bağlı";
  }
  if (integration.status === "PARTIALLY_CONNECTED") {
    return "Kısmen bağlı";
  }
  if (integration.status === "ERROR") return "Hata";
  if (integration.hasCredentials && !integration.providerConnectionReady) {
    return "Ayar kayıtlı";
  }
  return "Bağlı değil";
}

export function EDocumentIntegrationCard({ integration, onRefetch }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleTest() {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/e-document/test", {
        method: "POST",
      });
      const json = await res.json();
      setMessage(json.message ?? (res.ok ? "Bağlantı doğrulandı." : "Test başarısız."));
      await onRefetch();
    } catch {
      setMessage("Bağlantı testi sırasında hata oluştu.");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("E-belge bağlantısını kaldırmak istiyor musunuz?")) {
      return;
    }

    setDisconnecting(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/e-document", { method: "DELETE" });
      const json = await res.json();
      setMessage(json.message ?? (res.ok ? "Bağlantı kaldırıldı." : "İşlem başarısız."));
      await onRefetch();
    } catch {
      setMessage("Bağlantı kaldırılırken hata oluştu.");
    } finally {
      setDisconnecting(false);
    }
  }

  const canTest =
    integration.provider === "TRENDYOL_EFATURAM"
      ? integration.status === "CONNECTED"
      : integration.provider === "SOVOS"
        ? integration.hasCredentials
        : integration.hasCredentials;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">E-Belge</h3>
              <p className="mt-1 text-sm text-slate-500">
                e-Fatura ve e-Arşiv sağlayıcı bağlantısı
              </p>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(integration)}`}
          >
            {statusLabel(integration)}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>
            Sağlayıcı:{" "}
            <span className="font-medium text-slate-800">
              {integration.hasSavedIntegration
                ? integration.providerLabel
                : "Seçilmedi"}
            </span>
          </p>

          {integration.provider === "TRENDYOL_EFATURAM" ? (
            <>
              <p>
                Mod:{" "}
                <span className="font-medium text-slate-800">
                  {integration.connectionMode === "DIRECT_ACCOUNT"
                    ? "Doğrudan hesap"
                    : integration.connectionMode === "MARKETPLACE_PARTNER"
                      ? "Partner alt mükellef"
                      : "—"}
                </span>
              </p>
              <p>
                Ortam:{" "}
                <span className="font-medium text-slate-800">
                  {integration.environment === "LIVE"
                    ? "Canlı"
                    : integration.environment === "STAGE"
                      ? "Test"
                      : "—"}
                </span>
              </p>
              {!integration.partnerModeAvailable ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                  Partner modu platform credential eksikliği nedeniyle kapalı.
                </p>
              ) : null}
            </>
          ) : null}

          {integration.provider === "EFINANS" && integration.externalCompanyCode ? (
            <p>
              Firma kodu:{" "}
              <span className="font-medium text-slate-800">
                {integration.externalCompanyCode}
              </span>
            </p>
          ) : null}

          {integration.provider === "EFINANS" && integration.savedUsername ? (
            <p>
              Kullanıcı:{" "}
              <span className="font-medium text-slate-800">
                {integration.savedUsername}
              </span>
            </p>
          ) : null}

          {integration.provider === "SOVOS" ? (
            <>
              <p>
                Ortam:{" "}
                <span className="font-medium text-slate-800">
                  {integration.environment === "LIVE" ? "Canlı" : "Test"}
                </span>
              </p>
              {integration.taxId ? (
                <p>
                  VKN/TCKN:{" "}
                  <span className="font-medium text-slate-800">{integration.taxId}</span>
                </p>
              ) : null}
              {integration.externalCompanyCode ? (
                <p>
                  Firma kodu:{" "}
                  <span className="font-medium text-slate-800">
                    {integration.externalCompanyCode}
                  </span>
                </p>
              ) : null}
              {integration.senderIdentifier ? (
                <p>
                  GB:{" "}
                  <span className="font-medium text-slate-800">
                    {integration.senderIdentifier}
                  </span>
                </p>
              ) : null}
              {integration.savedUsername ? (
                <p>
                  E-Fatura WS:{" "}
                  <span className="font-medium text-slate-800">
                    {integration.savedUsername}
                  </span>
                </p>
              ) : null}
            </>
          ) : null}

          {integration.lastError ? (
            <p
              className={`rounded-xl px-3 py-2 ${
                integration.lastErrorCode === "SOVOS_SETTINGS_SAVED" ||
                integration.lastErrorCode === "SOVOS_REAL_TEST_DISABLED" ||
                integration.lastErrorCode === "ENDPOINT_NOT_CONFIGURED"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {integration.lastError}
            </p>
          ) : null}
        </div>

        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Settings2 size={16} />
            Yapılandır
          </button>
          {canTest ? (
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <PlugZap size={16} />
              )}
              Bağlantıyı Test Et
            </button>
          ) : null}
          {integration.hasCredentials || integration.status === "CONNECTED" ? (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              {disconnecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Unplug size={16} />
              )}
              Bağlantıyı kaldır
            </button>
          ) : null}
        </div>
      </div>

      <EDocumentConfigModal
        open={modalOpen}
        integration={integration}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setModalOpen(false);
          await onRefetch();
        }}
      />
    </>
  );
}
