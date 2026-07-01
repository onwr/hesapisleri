"use client";

import { useState } from "react";
import { Eye, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  getGibStatusLabel,
  getProviderStatusLabel,
  getSubmissionStatusLabel,
} from "@/lib/efaturam/efaturam-status-labels";

type TaxpayerAlias = {
  alias: string;
  type?: string;
  title?: string;
};

type SubmissionInfo = {
  status: string;
  documentType: string;
  providerInvoiceUuid?: string | null;
  providerInvoiceId?: string | null;
  providerStatus?: number | null;
  gibStatus?: string | null;
  targetAlias?: string | null;
  errorDetail?: string | null;
  lastQueriedAt?: string | null;
} | null;

type PreviewIssue = {
  field: string;
  message: string;
  lineIndex?: number;
};

type PreviewResult = {
  provider: string | null;
  recommendedDocumentType: "E_INVOICE" | "E_ARCHIVE";
  profileId: string | null;
  invoiceTypeCode: string;
  selectedAlias: string | null;
  availableAliases: TaxpayerAlias[];
  sellerIssues: PreviewIssue[];
  buyerIssues: PreviewIssue[];
  lineIssues: PreviewIssue[];
  internetSaleIssues: PreviewIssue[];
  snapshotIssues: PreviewIssue[];
  totalValidation: { ok: boolean; issues: PreviewIssue[] };
  xsdValidation: { ok: boolean; valid: boolean; schemaLoaded: boolean; issues: PreviewIssue[] };
  taxpayerLookup?: {
    syncOperation: string;
    lookupMethod: string;
    providerError: string | null;
    cacheHit: boolean;
    staleCache: boolean;
    status: string | null;
  };
  snapshot?: {
    ready: boolean;
    persisted: boolean;
    refreshed: boolean;
    locked: boolean;
    status: string | null;
    revisionHash: string | null;
    capturedAt: string | null;
  };
  entitlement: { featureEnabled: boolean; limitReached: boolean; message: string | null };
  sendable: boolean;
  identifiers: { previewUuid: string | null; custInvId: string | null };
};

type Props = {
  invoiceId: string;
  customerTaxNo?: string | null;
  integrationConnected: boolean;
  previewEnabled?: boolean;
  submitEnabled?: boolean;
  providerLabel?: string;
  submission: SubmissionInfo;
};

export function InvoiceEDocumentPanel({
  invoiceId,
  customerTaxNo,
  integrationConnected,
  previewEnabled = integrationConnected,
  submitEnabled = integrationConnected,
  providerLabel,
  submission,
}: Props) {
  const [taxId, setTaxId] = useState(customerTaxNo ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recommendedType, setRecommendedType] = useState<
    "E_INVOICE" | "E_ARCHIVE" | null
  >(null);
  const [aliases, setAliases] = useState<TaxpayerAlias[]>([]);
  const [selectedAlias, setSelectedAlias] = useState("");
  const [documentType, setDocumentType] = useState<"E_INVOICE" | "E_ARCHIVE">(
    "E_ARCHIVE"
  );
  const [internetSale, setInternetSale] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [localSubmission, setLocalSubmission] = useState(submission);

  const isSuccess = localSubmission?.status === "SUCCESS";
  const isSubmitted = Boolean(localSubmission?.providerInvoiceUuid);

  function renderIssues(title: string, issues: PreviewIssue[]) {
    if (issues.length === 0) return null;
    return (
      <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
        <p className="font-semibold">{title}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>
              <span className="font-medium">{issue.field}</span>: {issue.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-document/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          targetAlias: documentType === "E_INVOICE" ? selectedAlias : null,
          internetSale: documentType === "E_ARCHIVE" ? internetSale : false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Önizleme oluşturulamadı.");
        return;
      }
      const data = json.data as PreviewResult;
      setPreviewResult(data);
      setRecommendedType(data.recommendedDocumentType);
      setDocumentType(data.recommendedDocumentType);
      if (data.availableAliases.length === 1) {
        setSelectedAlias(data.availableAliases[0]!.alias);
      }
      setAliases(
        data.availableAliases.map((item) => ({
          alias: item.alias,
          type: item.type,
          title: item.title,
        }))
      );
      setMessage(
        data.sendable
          ? "Önizleme tamamlandı; belge gönderime hazır görünüyor."
          : "Önizleme tamamlandı; eksik veya hatalı alanlar var."
      );
    } catch {
      setError("Önizleme sırasında hata oluştu.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleLookup() {
    setLookupLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/integrations/efaturam/taxpayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Mükellef sorgusu başarısız.");
        return;
      }

      const activeAliases = (json.data.activeInvoiceAliases ?? []) as TaxpayerAlias[];
      setAliases(activeAliases);
      setRecommendedType(json.data.recommendedDocumentType);
      setDocumentType(json.data.recommendedDocumentType);
      if (activeAliases.length === 1) {
        setSelectedAlias(activeAliases[0].alias);
      }
      setMessage(
        json.data.recommendedDocumentType === "E_INVOICE"
          ? "Aktif e-Fatura posta kutusu bulundu."
          : "Aktif e-Fatura posta kutusu yok; e-Arşiv önerildi."
      );
    } catch {
      setError("Mükellef sorgusu sırasında hata oluştu.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit() {
    setSubmitLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-document/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          targetAlias: documentType === "E_INVOICE" ? selectedAlias : null,
          internetSale: documentType === "E_ARCHIVE" ? internetSale : false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "E-belge gönderilemedi.");
        return;
      }
      setMessage(json.message || "E-belge gönderildi.");
      setLocalSubmission({
        status: "SUBMITTED",
        documentType,
        providerInvoiceUuid: json.data.provider.invoiceUuid,
        providerInvoiceId: json.data.provider.invoiceId,
        providerStatus: json.data.provider.status,
        gibStatus: json.data.provider.gibStatus,
        targetAlias: documentType === "E_INVOICE" ? selectedAlias : null,
      });
      notifyTenantCacheSync();
    } catch {
      setError("E-belge gönderimi sırasında hata oluştu.");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleStatus() {
    setStatusLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-document/status`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Durum sorgulanamadı.");
        return;
      }
      const next = json.data.submission;
      setLocalSubmission(next);
      setMessage("Belge durumu güncellendi.");
    } catch {
      setError("Durum sorgusu sırasında hata oluştu.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-document/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "İptal başarısız.");
        return;
      }
      setLocalSubmission(json.data.submission);
      setMessage(json.message || "E-Arşiv iptal edildi.");
      notifyTenantCacheSync();
    } catch {
      setError("İptal sırasında hata oluştu.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/e-document/resend`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Yeniden gönderim başarısız.");
        return;
      }
      setMessage(json.message || "E-Fatura yeniden gönderildi.");
      notifyTenantCacheSync();
    } catch {
      setError("Yeniden gönderim sırasında hata oluştu.");
    } finally {
      setResendLoading(false);
    }
  }

  if (!previewEnabled && !integrationConnected) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        E-belge oluşturmak için Ayarlar &gt; Entegrasyonlar bölümünden
        {providerLabel ? ` ${providerLabel}` : ""} bağlantısını kurun.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">E-Belge Oluştur</h3>
        <p className="mt-1 text-sm text-slate-500">
          {submitEnabled
            ? "Bağlı sağlayıcı üzerinden e-Fatura veya e-Arşiv gönderin."
            : "UBL-TR önizleme ve doğrulama; gönderim henüz bu sağlayıcıda aktif değil."}
        </p>
      </div>

      {localSubmission ? (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Durum:{" "}
            <span className="font-semibold">
              {getSubmissionStatusLabel(
                localSubmission.status as "DRAFT" | "PENDING" | "SUBMITTED" | "SUCCESS" | "FAILED" | "CANCELLED"
              )}
            </span>
          </p>
          {localSubmission.providerInvoiceId ? (
            <p>Belge no: {localSubmission.providerInvoiceId}</p>
          ) : null}
          {localSubmission.providerStatus != null ? (
            <p>
              Sağlayıcı: {getProviderStatusLabel(localSubmission.providerStatus)}
            </p>
          ) : null}
          {localSubmission.gibStatus ? (
            <p>GİB: {getGibStatusLabel(localSubmission.gibStatus)}</p>
          ) : null}
          {localSubmission.errorDetail ? (
            <p className="text-red-600">{localSubmission.errorDetail}</p>
          ) : null}
        </div>
      ) : null}

      {!isSuccess && !isSubmitted ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={taxId}
              onChange={(event) => setTaxId(event.target.value)}
              placeholder="VKN / TCKN"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleLookup()}
              disabled={lookupLoading || !taxId.trim()}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : "Mükellef sorgula"}
            </button>
          </div>

          {recommendedType ? (
            <p className="text-sm text-slate-600">
              Önerilen belge türü:{" "}
              <span className="font-semibold text-slate-900">
                {recommendedType === "E_INVOICE" ? "e-Fatura" : "e-Arşiv"}
              </span>
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Belge türü
              <select
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as "E_INVOICE" | "E_ARCHIVE")
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="E_INVOICE">e-Fatura</option>
                <option value="E_ARCHIVE">e-Arşiv</option>
              </select>
            </label>

            {documentType === "E_INVOICE" && aliases.length > 1 ? (
              <label className="text-sm text-slate-700">
                Posta kutusu (alias)
                <select
                  value={selectedAlias}
                  onChange={(event) => setSelectedAlias(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Seçin</option>
                  {aliases.map((item) => (
                    <option key={item.alias} value={item.alias}>
                      {item.alias}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {documentType === "E_ARCHIVE" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={internetSale}
                onChange={(event) => setInternetSale(event.target.checked)}
              />
              İnternet satışı (paymentInfo + deliveryInfo gönder)
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={previewLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            Önizle ve doğrula
          </button>

          {submitEnabled ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitLoading ||
              (documentType === "E_INVOICE" && aliases.length > 0 && !selectedAlias)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Gönder
          </button>
          ) : null}

          {previewResult ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                Profil: <span className="font-semibold">{previewResult.profileId ?? "—"}</span> ·
                Tür: <span className="font-semibold">{previewResult.invoiceTypeCode}</span> ·
                Gönderilebilir:{" "}
                <span className="font-semibold">
                  {previewResult.sendable ? "Evet" : "Hayır"}
                </span>
              </p>
              {previewResult.identifiers.previewUuid ? (
                <p>Önizleme UUID: {previewResult.identifiers.previewUuid}</p>
              ) : null}
              {previewResult.snapshot ? (
                <p>
                  Snapshot:{" "}
                  <span className="font-semibold">
                    {previewResult.snapshot.locked
                      ? "Kilitli"
                      : previewResult.snapshot.ready
                        ? "Hazır"
                        : "Eksik"}
                  </span>
                  {previewResult.snapshot.status
                    ? ` · ${previewResult.snapshot.status}`
                    : ""}
                  {previewResult.snapshot.refreshed ? " · yenilendi" : ""}
                  {previewResult.snapshot.capturedAt
                    ? ` · ${new Date(previewResult.snapshot.capturedAt).toLocaleString("tr-TR")}`
                    : ""}
                </p>
              ) : null}
              {previewResult.taxpayerLookup?.providerError ? (
                <p className="text-red-700">
                  {previewResult.taxpayerLookup.providerError === "STALE_CACHE"
                    ? "Mükellef listesi önbelleği süresi dolmuş; Sovos erişilemiyor (STALE_CACHE)."
                    : previewResult.taxpayerLookup.providerError === "PROVIDER_UNAVAILABLE"
                      ? "Sovos mükellef listesi şu an erişilemiyor (PROVIDER_UNAVAILABLE)."
                      : previewResult.taxpayerLookup.providerError}
                </p>
              ) : null}
              {previewResult.taxpayerLookup ? (
                <p className="text-xs text-gray-600">
                  Mükellef: {previewResult.taxpayerLookup.syncOperation} →{" "}
                  {previewResult.taxpayerLookup.lookupMethod}
                  {previewResult.taxpayerLookup.cacheHit ? " (önbellek)" : ""}
                  {previewResult.taxpayerLookup.staleCache ? " (süresi dolmuş önbellek)" : ""}
                </p>
              ) : null}
              {renderIssues("Snapshot eksikleri", previewResult.snapshotIssues ?? [])}
              {renderIssues("Satıcı eksikleri", previewResult.sellerIssues)}
              {renderIssues("Alıcı eksikleri", previewResult.buyerIssues)}
              {renderIssues("Satır eksikleri", previewResult.lineIssues)}
              {renderIssues("İnternet satış eksikleri", previewResult.internetSaleIssues)}
              {renderIssues(
                previewResult.totalValidation.ok
                  ? "Toplam doğrulaması"
                  : "Toplam doğrulaması (kuruş farkı)",
                previewResult.totalValidation.issues
              )}
              {!previewResult.xsdValidation.schemaLoaded ? (
                <p className="text-sm text-red-700">
                  XSD şemaları yüklenemedi; belge gönderilemez.
                </p>
              ) : previewResult.xsdValidation.valid ? (
                <p className="text-sm text-emerald-700">XSD doğrulaması geçti (transport profili).</p>
              ) : null}
              {renderIssues("XSD doğrulaması", previewResult.xsdValidation.issues)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleStatus()}
            disabled={statusLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {statusLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Durum sorgula
          </button>
          {localSubmission?.documentType === "E_ARCHIVE" &&
          localSubmission.status !== "CANCELLED" ? (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
            >
              {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              İptal et
            </button>
          ) : null}
          {localSubmission?.documentType === "E_INVOICE" ? (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resendLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {resendLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Yeniden gönder
            </button>
          ) : null}
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
