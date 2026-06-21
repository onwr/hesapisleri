"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Send, XCircle } from "lucide-react";
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

type Props = {
  invoiceId: string;
  customerTaxNo?: string | null;
  integrationConnected: boolean;
  providerLabel?: string;
  submission: SubmissionInfo;
};

export function InvoiceEDocumentPanel({
  invoiceId,
  customerTaxNo,
  integrationConnected,
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
  const [localSubmission, setLocalSubmission] = useState(submission);

  const isSuccess = localSubmission?.status === "SUCCESS";
  const isSubmitted = Boolean(localSubmission?.providerInvoiceUuid);

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
    } catch {
      setError("Yeniden gönderim sırasında hata oluştu.");
    } finally {
      setResendLoading(false);
    }
  }

  if (!integrationConnected) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        E-belge oluşturmak için Ayarlar &gt; Entegrasyonlar bölümünden
        {providerLabel ? ` ${providerLabel}` : ""} bağlantısını kurun.
        {providerLabel && providerLabel !== "Trendyol E-Faturam"
          ? " Şu an yalnızca Trendyol E-Faturam ile belge gönderimi destekleniyor."
          : ""}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">E-Belge Oluştur</h3>
        <p className="mt-1 text-sm text-slate-500">
          Trendyol E-Faturam üzerinden e-Fatura veya e-Arşiv gönderin.
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
