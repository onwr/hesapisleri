"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import type { EDocumentIntegrationSummary } from "@/lib/e-document/e-document-integration-service";
import { E_DOCUMENT_PROVIDERS } from "@/lib/e-document/e-document-provider-registry";
import { IntegrationSecretInput } from "@/components/settings/integrations/integration-secret-input";

type ProviderCode = NonNullable<EDocumentIntegrationSummary["provider"]>;
type ProviderSelection = ProviderCode | "";

type Props = {
  open: boolean;
  integration: EDocumentIntegrationSummary;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400";

function ModalField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ModalSection({
  title,
  children,
  columns = 2,
}: {
  title: string;
  children: ReactNode;
  columns?: 2 | 3;
}) {
  const gridClass =
    columns === 3
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      : "grid gap-4 sm:grid-cols-2";

  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className={gridClass}>{children}</div>
    </section>
  );
}

function clearProviderFields(setters: {
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setUsername: (value: string) => void;
  setEfinansPassword: (value: string) => void;
  setCompanyCode: (value: string) => void;
  setPrefix: (value: string) => void;
  setXsltCode: (value: string) => void;
  setConnectionMode: (value: "DIRECT_ACCOUNT" | "MARKETPLACE_PARTNER") => void;
  setEnvironment: (value: "STAGE" | "LIVE") => void;
  setTaxId: (value: string) => void;
  setInvoiceUsername: (value: string) => void;
  setInvoicePassword: (value: string) => void;
  setUseSameArchiveCredentials: (value: boolean) => void;
  setArchiveUsername: (value: string) => void;
  setArchivePassword: (value: string) => void;
  setSenderIdentifier: (value: string) => void;
  setReceiverIdentifier: (value: string) => void;
  setBranchCode: (value: string) => void;
  setInvoiceSeries: (value: string) => void;
  setArchiveSeries: (value: string) => void;
}) {
  setters.setEmail("");
  setters.setPassword("");
  setters.setUsername("");
  setters.setEfinansPassword("");
  setters.setCompanyCode("");
  setters.setPrefix("");
  setters.setXsltCode("");
  setters.setConnectionMode("DIRECT_ACCOUNT");
  setters.setEnvironment("STAGE");
  setters.setTaxId("");
  setters.setInvoiceUsername("");
  setters.setInvoicePassword("");
  setters.setUseSameArchiveCredentials(true);
  setters.setArchiveUsername("");
  setters.setArchivePassword("");
  setters.setSenderIdentifier("");
  setters.setReceiverIdentifier("");
  setters.setBranchCode("");
  setters.setInvoiceSeries("");
  setters.setArchiveSeries("");
}

export function EDocumentConfigModal({
  open,
  integration,
  onClose,
  onSaved,
}: Props) {
  const [provider, setProvider] = useState<ProviderSelection>("");
  const [savedProvider, setSavedProvider] = useState<ProviderCode | null>(null);
  const [connectionMode, setConnectionMode] = useState<
    "DIRECT_ACCOUNT" | "MARKETPLACE_PARTNER"
  >("DIRECT_ACCOUNT");
  const [environment, setEnvironment] = useState<"STAGE" | "LIVE">("STAGE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prefix, setPrefix] = useState("");
  const [xsltCode, setXsltCode] = useState("");
  const [username, setUsername] = useState("");
  const [efinansPassword, setEfinansPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [taxId, setTaxId] = useState("");
  const [invoiceUsername, setInvoiceUsername] = useState("");
  const [invoicePassword, setInvoicePassword] = useState("");
  const [useSameArchiveCredentials, setUseSameArchiveCredentials] = useState(true);
  const [archiveUsername, setArchiveUsername] = useState("");
  const [archivePassword, setArchivePassword] = useState("");
  const [senderIdentifier, setSenderIdentifier] = useState("");
  const [receiverIdentifier, setReceiverIdentifier] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [archiveSeries, setArchiveSeries] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fieldSetters = {
    setEmail,
    setPassword,
    setUsername,
    setEfinansPassword,
    setCompanyCode,
    setPrefix,
    setXsltCode,
    setConnectionMode,
    setEnvironment,
    setTaxId,
    setInvoiceUsername,
    setInvoicePassword,
    setUseSameArchiveCredentials,
    setArchiveUsername,
    setArchivePassword,
    setSenderIdentifier,
    setReceiverIdentifier,
    setBranchCode,
    setInvoiceSeries,
    setArchiveSeries,
  };

  useEffect(() => {
    if (!open) return;

    const initialProvider =
      integration.hasSavedIntegration && integration.provider
        ? integration.provider
        : null;

    setSavedProvider(initialProvider);
    setProvider(initialProvider ?? "");
    setConnectionMode(integration.connectionMode ?? "DIRECT_ACCOUNT");
    setEnvironment(integration.environment ?? "STAGE");
    setPrefix(integration.prefix ?? "");
    setXsltCode(integration.xsltCode ?? "");
    setCompanyCode(integration.externalCompanyCode ?? "");
    setTaxId(integration.taxId ?? "");
    setSenderIdentifier(integration.senderIdentifier ?? "");
    setReceiverIdentifier(integration.receiverIdentifier ?? "");
    setBranchCode(integration.branchCode ?? "");
    setInvoiceSeries(integration.invoiceSeries ?? "");
    setArchiveSeries(integration.archiveSeries ?? "");
    setUseSameArchiveCredentials(integration.useSameArchiveCredentials);
    setEmail("");
    setPassword("");
    setUsername("");
    setEfinansPassword("");
    setInvoiceUsername("");
    setInvoicePassword("");
    setArchiveUsername("");
    setArchivePassword("");
    setError("");
  }, [open, integration]);

  if (!open) return null;

  function handleProviderChange(next: ProviderSelection) {
    if (next === provider) return;

    if (
      integration.hasSavedIntegration &&
      savedProvider &&
      next !== "" &&
      next !== savedProvider
    ) {
      const confirmed = window.confirm(
        "Sağlayıcıyı değiştirirseniz mevcut bağlantı ayarları silinecek. Devam etmek istiyor musunuz?"
      );
      if (!confirmed) return;
    }

    clearProviderFields(fieldSetters);

    if (next === "TRENDYOL_EFATURAM" && savedProvider === "TRENDYOL_EFATURAM") {
      setConnectionMode(integration.connectionMode ?? "DIRECT_ACCOUNT");
      setEnvironment(integration.environment ?? "STAGE");
      setPrefix(integration.prefix ?? "");
      setXsltCode(integration.xsltCode ?? "");
    }

    if (next === "EFINANS" && savedProvider === "EFINANS") {
      setEnvironment(integration.environment ?? "STAGE");
      setCompanyCode(integration.externalCompanyCode ?? "");
    }

    if (next === "SOVOS" && savedProvider === "SOVOS") {
      setEnvironment(integration.environment ?? "STAGE");
      setCompanyCode(integration.externalCompanyCode ?? "");
      setTaxId(integration.taxId ?? "");
      setSenderIdentifier(integration.senderIdentifier ?? "");
      setReceiverIdentifier(integration.receiverIdentifier ?? "");
      setBranchCode(integration.branchCode ?? "");
      setInvoiceSeries(integration.invoiceSeries ?? "");
      setArchiveSeries(integration.archiveSeries ?? "");
      setUseSameArchiveCredentials(integration.useSameArchiveCredentials);
    }

    setProvider(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!provider) {
      setError("Lütfen bir sağlayıcı seçin.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body =
        provider === "TRENDYOL_EFATURAM"
          ? {
              provider,
              connectionMode,
              environment,
              email: connectionMode === "DIRECT_ACCOUNT" ? email : undefined,
              password:
                connectionMode === "DIRECT_ACCOUNT" && password.trim()
                  ? password
                  : undefined,
              prefix: prefix.trim() ? prefix.trim().toUpperCase() : null,
              xsltCode: xsltCode.trim() || null,
            }
          : provider === "EFINANS"
            ? {
                provider,
                username,
                password: efinansPassword.trim() ? efinansPassword : undefined,
                companyCode,
                environment,
              }
            : provider === "SOVOS"
              ? {
                  provider,
                  environment,
                  externalCompanyCode: companyCode.trim() || null,
                  taxId,
                  invoiceUsername: invoiceUsername.trim() || undefined,
                  invoicePassword: invoicePassword.trim() ? invoicePassword : undefined,
                  useSameArchiveCredentials,
                  archiveUsername:
                    useSameArchiveCredentials || !archiveUsername.trim()
                      ? undefined
                      : archiveUsername,
                  archivePassword:
                    useSameArchiveCredentials || !archivePassword.trim()
                      ? undefined
                      : archivePassword,
                  senderIdentifier: senderIdentifier.trim() || null,
                  receiverIdentifier: receiverIdentifier.trim() || null,
                  branchCode: branchCode.trim() || null,
                  invoiceSeries: invoiceSeries.trim() || null,
                  archiveSeries: archiveSeries.trim() || null,
                }
              : { provider };

      const res = await fetch("/api/integrations/e-document", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Bağlantı kaydedilemedi.");
        return;
      }
      await onSaved();
    } catch {
      setError("Bağlantı kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const submitLabel =
    provider === "EFINANS" || provider === "SOVOS"
      ? "Ayarları Kaydet"
      : provider === "TRENDYOL_EFATURAM"
        ? "Kaydet ve bağlan"
        : "Kaydet";

  const isWideLayout =
    provider === "SOVOS" || provider === "TRENDYOL_EFATURAM";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
      <div
        className={[
          "flex max-h-[min(90vh,820px)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl",
          isWideLayout ? "max-w-4xl" : "max-w-xl",
        ].join(" ")}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">E-Belge Bağlantısı</h2>
            <p className="text-sm text-slate-500">e-Fatura / e-Arşiv sağlayıcı ayarları</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Bilgilerinizi kullandığınız e-fatura özel entegratörünün panelinden
              alabilirsiniz.
            </p>

            <ModalField label="Sağlayıcı">
              <select
                value={provider}
                onChange={(event) =>
                  handleProviderChange(event.target.value as ProviderSelection)
                }
                className={inputClassName}
                required
              >
                <option value="">Sağlayıcı seçin</option>
                {E_DOCUMENT_PROVIDERS.map((item) => (
                  <option key={item.code} value={item.code} disabled={!item.selectable}>
                    {item.label}
                    {!item.connectionReady && item.code !== "OTHER" ? " (yakında)" : ""}
                  </option>
                ))}
              </select>
            </ModalField>

          {provider === "EFINANS" ? (
            <>
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                eFinans API entegrasyonu henüz hazır değil. Ayarlar güvenli biçimde
                saklanır; bağlantı tamamlandı olarak gösterilmez.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Kullanıcı adı
                </label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={integration.savedUsername ?? ""}
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required={
                    !(
                      integration.savedUsername && savedProvider === "EFINANS"
                    )
                  }
                />
                {integration.savedUsername && savedProvider === "EFINANS" ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Kayıtlı: {integration.savedUsername}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Şifre
                </label>
                <IntegrationSecretInput
                  value={efinansPassword}
                  onChange={setEfinansPassword}
                  savedBadge={
                    integration.hasSavedPassword && savedProvider === "EFINANS"
                      ? "kayıtlı"
                      : null
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Firma kodu
                </label>
                <input
                  value={companyCode}
                  onChange={(event) => setCompanyCode(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ortam
                </label>
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as "STAGE" | "LIVE")
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="STAGE">Test</option>
                  <option value="LIVE">Canlı</option>
                </select>
              </div>
            </>
          ) : null}

          {provider === "TRENDYOL_EFATURAM" ? (
            <>
              {connectionMode === "DIRECT_ACCOUNT" ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      E-posta
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      placeholder="ornek@firma.com"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Şifre
                    </label>
                    <IntegrationSecretInput
                      value={password}
                      onChange={setPassword}
                      savedBadge={
                        integration.hasSavedPassword &&
                        savedProvider === "TRENDYOL_EFATURAM"
                          ? "kayıtlı"
                          : null
                      }
                    />
                  </div>
                </>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Bağlantı modu
                </label>
                <select
                  value={connectionMode}
                  onChange={(event) =>
                    setConnectionMode(
                      event.target.value as "DIRECT_ACCOUNT" | "MARKETPLACE_PARTNER"
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="DIRECT_ACCOUNT">Doğrudan E-Faturam hesabı</option>
                  <option
                    value="MARKETPLACE_PARTNER"
                    disabled={!integration.partnerModeAvailable}
                  >
                    Partner alt mükellef
                    {!integration.partnerModeAvailable ? " (kapalı)" : ""}
                  </option>
                </select>
              </div>

              {connectionMode === "MARKETPLACE_PARTNER" ? (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Partner modunda firma VKN/TCKN bilgisi kullanılarak alt mükellef
                  oturumu açılır.
                </p>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ortam
                </label>
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(event.target.value as "STAGE" | "LIVE")
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="STAGE">Test (stage-apigateway.trendyolefaturam.com)</option>
                  <option value="LIVE">Canlı (apigateway.trendyolecozum.com)</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fatura öneki
                  </label>
                  <input
                    value={prefix}
                    onChange={(event) => setPrefix(event.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="ABC"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    XSLT kodu
                  </label>
                  <input
                    value={xsltCode}
                    onChange={(event) => setXsltCode(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          ) : null}

          {provider === "SOVOS" ? (
            <div className="space-y-4">
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
                Sovos/Digital Planet web servis bilgilerinizi girin. Portal girişi ile WS
                bilgileri farklı olabilir. Bağlantı testi endpoint doğrulandıktan sonra
                açılacaktır.
              </p>

              <ModalSection title="Firma Bilgileri" columns={3}>
                <ModalField label="Ortam">
                  <select
                    value={environment}
                    onChange={(event) =>
                      setEnvironment(event.target.value as "STAGE" | "LIVE")
                    }
                    className={inputClassName}
                  >
                    <option value="STAGE">Test</option>
                    <option value="LIVE">Canlı</option>
                  </select>
                </ModalField>
                <ModalField label="Firma kodu">
                  <input
                    value={companyCode}
                    onChange={(event) => setCompanyCode(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
                <ModalField label="VKN/TCKN">
                  <input
                    value={taxId}
                    onChange={(event) =>
                      setTaxId(event.target.value.replace(/\D/g, ""))
                    }
                    maxLength={11}
                    className={inputClassName}
                    required
                  />
                </ModalField>
              </ModalSection>

              <ModalSection title="E-Fatura Web Servis">
                <ModalField
                  label="Kullanıcı adı"
                  hint={
                    integration.savedUsername && savedProvider === "SOVOS"
                      ? `Kayıtlı: ${integration.savedUsername}`
                      : undefined
                  }
                >
                  <input
                    value={invoiceUsername}
                    onChange={(event) => setInvoiceUsername(event.target.value)}
                    placeholder={integration.savedUsername ?? ""}
                    autoComplete="username"
                    className={inputClassName}
                    required={
                      !(integration.savedUsername && savedProvider === "SOVOS")
                    }
                  />
                </ModalField>
                <ModalField label="Şifre">
                  <IntegrationSecretInput
                    value={invoicePassword}
                    onChange={setInvoicePassword}
                    savedBadge={
                      integration.hasSavedInvoicePassword && savedProvider === "SOVOS"
                        ? "kayıtlı"
                        : null
                    }
                  />
                </ModalField>
              </ModalSection>

              <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={useSameArchiveCredentials}
                    onChange={(event) =>
                      setUseSameArchiveCredentials(event.target.checked)
                    }
                    className="rounded border-slate-300"
                  />
                  E-Arşiv için aynı web servis bilgilerini kullan
                </label>

                {!useSameArchiveCredentials ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ModalField
                      label="E-Arşiv kullanıcı adı"
                      hint={
                        integration.savedArchiveUsername && savedProvider === "SOVOS"
                          ? `Kayıtlı: ${integration.savedArchiveUsername}`
                          : undefined
                      }
                    >
                      <input
                        value={archiveUsername}
                        onChange={(event) => setArchiveUsername(event.target.value)}
                        placeholder={integration.savedArchiveUsername ?? ""}
                        autoComplete="username"
                        className={inputClassName}
                        required={
                          !(
                            integration.savedArchiveUsername &&
                            savedProvider === "SOVOS"
                          )
                        }
                      />
                    </ModalField>
                    <ModalField label="E-Arşiv şifre">
                      <IntegrationSecretInput
                        value={archivePassword}
                        onChange={setArchivePassword}
                        savedBadge={
                          integration.hasSavedArchivePassword &&
                          savedProvider === "SOVOS"
                            ? "kayıtlı"
                            : null
                        }
                      />
                    </ModalField>
                  </div>
                ) : null}
              </section>

              <ModalSection title="GİB Tanımlayıcıları & Seriler" columns={3}>
                <ModalField label="Gönderici Birim (GB)">
                  <input
                    value={senderIdentifier}
                    onChange={(event) => setSenderIdentifier(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
                <ModalField label="Posta Kutusu (PK)">
                  <input
                    value={receiverIdentifier}
                    onChange={(event) => setReceiverIdentifier(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
                <ModalField label="Şube kodu">
                  <input
                    value={branchCode}
                    onChange={(event) => setBranchCode(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
                <ModalField label="Fatura seri kodu">
                  <input
                    value={invoiceSeries}
                    onChange={(event) => setInvoiceSeries(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
                <ModalField label="E-Arşiv seri kodu">
                  <input
                    value={archiveSeries}
                    onChange={(event) => setArchiveSeries(event.target.value)}
                    className={inputClassName}
                  />
                </ModalField>
              </ModalSection>
            </div>
          ) : null}

          {provider === "OTHER" ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Diğer sağlayıcılar yakında eklenecek.
            </p>
          ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving || !provider || provider === "OTHER"}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
