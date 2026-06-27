"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Globe,
  HardDrive,
  Headphones,
  Lock,
  PiggyBank,
  Settings2,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  AdminFormField,
  AdminTextarea,
  AdminTextInput,
  AdminToggleRow,
} from "@/components/admin/layout/admin-form-field";
import { AdminSettingsSection } from "@/components/admin/layout/admin-settings-section";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import {
  formatMoneyInput,
  parseTurkishMoneyInput,
} from "@/lib/money-input-utils";

type Settings = {
  id: string;
  version: number;
  brandName: string;
  supportEmail: string;
  supportPhone: string | null;
  websiteUrl: string;
  registrationEnabled: boolean;
  trialDays: number;
  trialAmount: number;
  defaultCurrency: string;
  defaultVatRate: number;
  defaultNotifyLowStock: boolean;
  defaultNotifyDueInvoices: boolean;
  defaultNotifyLateCollections: boolean;
  defaultNotifyDailySummary: boolean;
  defaultNotifyEmployeePayments: boolean;
  maxImageBytes: number;
  maxTaxCertificateBytes: number;
  sessionMaxAgeDays: number;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  updatedAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  brandName: "Marka adı",
  supportEmail: "Destek e-postası",
  supportPhone: "Destek telefonu",
  websiteUrl: "Web sitesi",
  registrationEnabled: "Kayıt açık",
  trialDays: "Deneme süresi",
  trialAmount: "Deneme tutarı",
  defaultCurrency: "Varsayılan para birimi",
  defaultVatRate: "Varsayılan KDV",
  defaultNotifyLowStock: "Düşük stok bildirimi",
  defaultNotifyDueInvoices: "Vadesi gelen faturalar",
  defaultNotifyLateCollections: "Geciken tahsilatlar",
  defaultNotifyDailySummary: "Günlük özet",
  defaultNotifyEmployeePayments: "Personel ödemeleri",
  maxImageBytes: "Görsel limiti",
  maxTaxCertificateBytes: "Vergi levhası limiti",
  sessionMaxAgeDays: "Oturum süresi",
  maintenanceMode: "Bakım modu",
  maintenanceMessage: "Bakım mesajı",
};

const CRITICAL_FIELDS = new Set([
  "registrationEnabled",
  "maintenanceMode",
  "trialDays",
  "maxImageBytes",
  "maxTaxCertificateBytes",
  "sessionMaxAgeDays",
  "defaultVatRate",
]);

function bytesToMb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

function mbToBytes(mb: number) {
  return mb * 1024 * 1024;
}

function diffFields(
  initial: Settings,
  next: Settings,
  trialAmount: number,
  maxImageMb: number,
  maxTaxMb: number
) {
  const fields: string[] = [];
  if (initial.brandName !== next.brandName) fields.push("brandName");
  if (initial.supportEmail !== next.supportEmail) fields.push("supportEmail");
  if ((initial.supportPhone ?? "") !== (next.supportPhone ?? "")) fields.push("supportPhone");
  if (initial.websiteUrl !== next.websiteUrl) fields.push("websiteUrl");
  if (initial.registrationEnabled !== next.registrationEnabled) fields.push("registrationEnabled");
  if (initial.trialDays !== next.trialDays) fields.push("trialDays");
  if (initial.trialAmount !== trialAmount) fields.push("trialAmount");
  if (initial.defaultCurrency !== next.defaultCurrency) fields.push("defaultCurrency");
  if (initial.defaultVatRate !== next.defaultVatRate) fields.push("defaultVatRate");
  if (initial.defaultNotifyLowStock !== next.defaultNotifyLowStock) fields.push("defaultNotifyLowStock");
  if (initial.defaultNotifyDueInvoices !== next.defaultNotifyDueInvoices) {
    fields.push("defaultNotifyDueInvoices");
  }
  if (initial.defaultNotifyLateCollections !== next.defaultNotifyLateCollections) {
    fields.push("defaultNotifyLateCollections");
  }
  if (initial.defaultNotifyDailySummary !== next.defaultNotifyDailySummary) {
    fields.push("defaultNotifyDailySummary");
  }
  if (initial.defaultNotifyEmployeePayments !== next.defaultNotifyEmployeePayments) {
    fields.push("defaultNotifyEmployeePayments");
  }
  if (bytesToMb(initial.maxImageBytes) !== maxImageMb) fields.push("maxImageBytes");
  if (bytesToMb(initial.maxTaxCertificateBytes) !== maxTaxMb) fields.push("maxTaxCertificateBytes");
  if (initial.sessionMaxAgeDays !== next.sessionMaxAgeDays) fields.push("sessionMaxAgeDays");
  if (initial.maintenanceMode !== next.maintenanceMode) fields.push("maintenanceMode");
  if ((initial.maintenanceMessage ?? "") !== (next.maintenanceMessage ?? "")) {
    fields.push("maintenanceMessage");
  }
  return fields;
}

function hasCriticalChanges(fields: string[]) {
  return fields.some((field) => CRITICAL_FIELDS.has(field));
}

function isSeriousUploadDecrease(initialBytes: number, nextMb: number) {
  return mbToBytes(nextMb) < initialBytes * 0.75;
}

export function AdminPlatformSettingsForm({
  initial,
  formId = "platform-settings-form",
  onSavingChange,
  onSaved,
}: {
  initial: Settings;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
  onSaved?: (settings: Settings) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [trialAmountInput, setTrialAmountInput] = useState(formatMoneyInput(initial.trialAmount));
  const [maxImageMb, setMaxImageMb] = useState(bytesToMb(initial.maxImageBytes));
  const [maxTaxMb, setMaxTaxMb] = useState(bytesToMb(initial.maxTaxCertificateBytes));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function reloadSettings() {
    const res = await fetch("/api/admin/platform-settings");
    const json = await res.json();
    if (res.ok && json.success) {
      const next = json.data.settings as Settings;
      setForm(next);
      setTrialAmountInput(formatMoneyInput(next.trialAmount));
      setMaxImageMb(bytesToMb(next.maxImageBytes));
      setMaxTaxMb(bytesToMb(next.maxTaxCertificateBytes));
      onSaved?.(next);
    }
  }

  function validateLocal(trialAmount: number): string | null {
    if (trialAmount < 0) return "Deneme tutarı negatif olamaz.";
    if (form.trialDays < 1 || form.trialDays > 90) {
      return "Deneme süresi 1–90 gün arasında olmalıdır.";
    }
    if (form.defaultVatRate < 0 || form.defaultVatRate > 100) {
      return "KDV oranı 0–100 arasında olmalıdır.";
    }
    if (maxImageMb < 1 || maxImageMb > 20) return "Görsel limiti 1–20 MB arasında olmalıdır.";
    if (maxTaxMb < 1 || maxTaxMb > 20) return "Vergi levhası limiti 1–20 MB arasında olmalıdır.";
    if (form.sessionMaxAgeDays < 1 || form.sessionMaxAgeDays > 30) {
      return "Oturum süresi 1–30 gün arasında olmalıdır.";
    }
    return null;
  }

  async function submit(reasonText: string) {
    if (loading) return;

    const trialAmount = parseTurkishMoneyInput(trialAmountInput);
    if (trialAmount === null) {
      setError("Deneme tutarı geçerli bir değer olmalıdır.");
      return;
    }

    const localError = validateLocal(trialAmount);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    onSavingChange?.(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: form.version,
          brandName: form.brandName,
          supportEmail: form.supportEmail,
          supportPhone: form.supportPhone,
          websiteUrl: form.websiteUrl,
          registrationEnabled: form.registrationEnabled,
          trialDays: form.trialDays,
          trialAmount,
          defaultCurrency: form.defaultCurrency,
          defaultVatRate: form.defaultVatRate,
          defaultNotifyLowStock: form.defaultNotifyLowStock,
          defaultNotifyDueInvoices: form.defaultNotifyDueInvoices,
          defaultNotifyLateCollections: form.defaultNotifyLateCollections,
          defaultNotifyDailySummary: form.defaultNotifyDailySummary,
          defaultNotifyEmployeePayments: form.defaultNotifyEmployeePayments,
          maxImageBytes: mbToBytes(maxImageMb),
          maxTaxCertificateBytes: mbToBytes(maxTaxMb),
          sessionMaxAgeDays: form.sessionMaxAgeDays,
          maintenanceMode: form.maintenanceMode,
          maintenanceMessage: form.maintenanceMessage,
          reason: reasonText.trim(),
          confirm: true,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.code === "PLATFORM_SETTINGS_VERSION_CONFLICT") {
          setError(
            "Ayarlar başka bir oturumda güncellendi. Güncel değerler yüklendi; lütfen değişikliklerinizi tekrar uygulayın."
          );
          await reloadSettings();
          return;
        }
        setError(json.message || "Ayarlar kaydedilemedi.");
        return;
      }

      const next = json.data.settings as Settings;
      setMessage("Platform ayarları başarıyla güncellendi.");
      setForm(next);
      setTrialAmountInput(formatMoneyInput(next.trialAmount));
      setMaxImageMb(bytesToMb(next.maxImageBytes));
      setMaxTaxMb(bytesToMb(next.maxTaxCertificateBytes));
      setConfirmOpen(false);
      setReason("");
      setConfirm(false);
      onSaved?.(next);
      router.refresh();
    } catch {
      setError("Ayarlar kaydedilirken hata oluştu.");
    } finally {
      setLoading(false);
      onSavingChange?.(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const trialAmount = parseTurkishMoneyInput(trialAmountInput);
    if (trialAmount === null) {
      setError("Deneme tutarı geçerli bir değer olmalıdır.");
      return;
    }

    const localError = validateLocal(trialAmount);
    if (localError) {
      setError(localError);
      return;
    }

    const fields = diffFields(initial, form, trialAmount, maxImageMb, maxTaxMb);
    if (!fields.length) {
      setError("Kaydedilecek değişiklik yok.");
      return;
    }

    setConfirmOpen(true);
  }

  const pendingTrialAmount =
    parseTurkishMoneyInput(trialAmountInput) ?? initial.trialAmount;
  const pendingFields = diffFields(initial, form, pendingTrialAmount, maxImageMb, maxTaxMb);

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}

        <AdminSettingsSection
          title="Platform kimliği"
          description="Marka ve genel platform kimliği."
          icon={Globe}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Marka adı">
              <AdminTextInput
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              />
            </AdminFormField>
            <AdminFormField label="Web sitesi">
              <AdminTextInput
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              />
            </AdminFormField>
          </div>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Destek ve iletişim"
          description="Kullanıcılara gösterilen destek kanalları."
          icon={Headphones}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Destek e-postası">
              <AdminTextInput
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </AdminFormField>
            <AdminFormField label="Destek telefonu">
              <AdminTextInput
                value={form.supportPhone ?? ""}
                onChange={(e) =>
                  setForm({ ...form, supportPhone: e.target.value.trim() || null })
                }
              />
            </AdminFormField>
          </div>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Kayıt / onboarding"
          description="Yeni public kayıt davranışı."
          icon={UserPlus}
        >
          <AdminToggleRow
            label="Yeni kayıtlar açık"
            description="Kapalıyken mevcut kullanıcılar etkilenmez; yalnız yeni register engellenir."
            checked={form.registrationEnabled}
            onChange={(checked) => setForm({ ...form, registrationEnabled: checked })}
          />
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Trial varsayılanları"
          description="Yeni oluşturulan firmalara uygulanır; mevcut trial kayıtları değişmez."
          icon={Settings2}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Deneme süresi (gün)">
              <AdminTextInput
                type="number"
                min={1}
                max={90}
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}
              />
            </AdminFormField>
            <AdminFormField label="Deneme tutarı (TRY)">
              <AdminTextInput
                value={trialAmountInput}
                onChange={(e) => setTrialAmountInput(e.target.value)}
                inputMode="decimal"
              />
            </AdminFormField>
          </div>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Finansal varsayılanlar"
          description="Yeni firma oluşturulurken uygulanır; geçmiş ödemeler değişmez."
          icon={PiggyBank}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Varsayılan para birimi">
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                value={form.defaultCurrency}
                onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </AdminFormField>
            <AdminFormField label="Varsayılan KDV (%)">
              <AdminTextInput
                type="number"
                min={0}
                max={100}
                value={form.defaultVatRate}
                onChange={(e) => setForm({ ...form, defaultVatRate: Number(e.target.value) })}
              />
            </AdminFormField>
          </div>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Dosya / yükleme limitleri"
          description="Yeni yüklemelerde geçerlidir; mevcut dosyalar etkilenmez."
          icon={HardDrive}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Görsel limiti (MB)">
              <AdminTextInput
                type="number"
                min={1}
                max={20}
                value={maxImageMb}
                onChange={(e) => setMaxImageMb(Number(e.target.value))}
              />
            </AdminFormField>
            <AdminFormField label="Vergi levhası limiti (MB)">
              <AdminTextInput
                type="number"
                min={1}
                max={20}
                value={maxTaxMb}
                onChange={(e) => setMaxTaxMb(Number(e.target.value))}
              />
            </AdminFormField>
          </div>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Bildirim varsayılanları"
          description="Yeni firma CompanySettings oluşturulurken uygulanır."
          icon={Bell}
        >
          <AdminToggleRow
            label="Düşük stok bildirimi"
            description="Yeni firmalarda varsayılan olarak açık."
            checked={form.defaultNotifyLowStock}
            onChange={(checked) => setForm({ ...form, defaultNotifyLowStock: checked })}
          />
          <AdminToggleRow
            label="Vadesi gelen faturalar"
            description="Yeni firmalarda varsayılan olarak açık."
            checked={form.defaultNotifyDueInvoices}
            onChange={(checked) => setForm({ ...form, defaultNotifyDueInvoices: checked })}
          />
          <AdminToggleRow
            label="Geciken tahsilatlar"
            description="Yeni firmalarda varsayılan olarak açık."
            checked={form.defaultNotifyLateCollections}
            onChange={(checked) => setForm({ ...form, defaultNotifyLateCollections: checked })}
          />
          <AdminToggleRow
            label="Günlük özet"
            description="Yeni firmalarda varsayılan olarak kapalı."
            checked={form.defaultNotifyDailySummary}
            onChange={(checked) => setForm({ ...form, defaultNotifyDailySummary: checked })}
          />
          <AdminToggleRow
            label="Personel ödemeleri"
            description="Yeni firmalarda varsayılan olarak açık."
            checked={form.defaultNotifyEmployeePayments}
            onChange={(checked) => setForm({ ...form, defaultNotifyEmployeePayments: checked })}
          />
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Güvenlik varsayılanları"
          description="Yeni oturumlar için geçerlidir; mevcut session kayıtları değişmez."
          icon={Lock}
        >
          <AdminFormField label="Oturum süresi (gün)">
            <AdminTextInput
              type="number"
              min={1}
              max={30}
              value={form.sessionMaxAgeDays}
              onChange={(e) => setForm({ ...form, sessionMaxAgeDays: Number(e.target.value) })}
            />
          </AdminFormField>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Bakım veya erişim durumu"
          description="Super Admin erişimi korunur; cron/callback route'ları etkilenmez."
          icon={Wrench}
        >
          <AdminToggleRow
            label="Bakım modu"
            description="Aktifken kullanıcı-facing uygulama erişimi sınırlandırılır."
            checked={form.maintenanceMode}
            onChange={(checked) => setForm({ ...form, maintenanceMode: checked })}
          />
          <AdminFormField label="Bakım mesajı">
            <AdminTextarea
              value={form.maintenanceMessage ?? ""}
              onChange={(e) =>
                setForm({ ...form, maintenanceMessage: e.target.value.trim() || null })
              }
            />
          </AdminFormField>
        </AdminSettingsSection>
      </form>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md space-y-4 p-5`}>
            <h3 className="text-lg font-bold text-slate-800">Platform ayar değişikliğini onayla</h3>
            <p className="text-[13px] text-slate-600">
              Değişecek alanlar: {pendingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
            </p>
            {hasCriticalChanges(pendingFields) ? (
              <p className="text-[12px] font-semibold text-amber-700">
                Kritik ayar değişikliği — geçmiş abonelik, ödeme, trial ve dosyalar etkilenmez.
              </p>
            ) : null}
            {(isSeriousUploadDecrease(initial.maxImageBytes, maxImageMb) ||
              isSeriousUploadDecrease(initial.maxTaxCertificateBytes, maxTaxMb)) && (
              <p className="text-[12px] font-semibold text-amber-700">
                Yükleme limiti ciddi şekilde düşürülüyor — yalnız yeni yüklemeler etkilenir.
              </p>
            )}
            <label className="block text-[13px]">
              Gerekçe (zorunlu)
              <textarea
                className="mt-1 w-full rounded border px-3 py-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Değişiklikleri onaylıyorum
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={appOutlineButtonClass}
                disabled={loading}
                onClick={() => {
                  setConfirmOpen(false);
                  setReason("");
                  setConfirm(false);
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={loading || !confirm || !reason.trim()}
                onClick={() => void submit(reason)}
              >
                {loading ? "Kaydediliyor…" : "Onayla ve kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
