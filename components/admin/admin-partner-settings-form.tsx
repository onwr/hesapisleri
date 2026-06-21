"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Cookie,
  FileText,
  Percent,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  AdminFormField,
  AdminTextarea,
  AdminTextInput,
  AdminToggleRow,
} from "@/components/admin/layout/admin-form-field";
import { AdminSettingsSection } from "@/components/admin/layout/admin-settings-section";
import { appPrimaryButtonClass } from "@/lib/admin-ui";
import {
  formatMoneyInput,
  parseTurkishMoneyInput,
} from "@/lib/money-input-utils";

type Settings = {
  defaultCommissionRate: number;
  cookieDurationDays: number;
  minimumPayoutAmount: number;
  autoApproveConversions: boolean;
  commissionOnRenewals: boolean;
  isApplicationOpen: boolean;
  termsText: string | null;
};

type AdminPartnerSettingsFormProps = {
  initial: Settings;
  formId?: string;
  showFooterSave?: boolean;
  onSavingChange?: (saving: boolean) => void;
};

export function AdminPartnerSettingsForm({
  initial,
  formId = "partner-settings-form",
  showFooterSave = false,
  onSavingChange,
}: AdminPartnerSettingsFormProps) {
  const [form, setForm] = useState(initial);
  const [minPayoutInput, setMinPayoutInput] = useState(
    formatMoneyInput(initial.minimumPayoutAmount)
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const minimumPayoutAmount = parseTurkishMoneyInput(minPayoutInput);
    if (minimumPayoutAmount === null || minimumPayoutAmount < 0) {
      setError("Minimum ödeme tutarı geçerli bir değer olmalıdır.");
      return;
    }

    if (form.cookieDurationDays < 1 || form.cookieDurationDays > 365) {
      setError("Cookie süresi 1–365 gün arasında olmalıdır.");
      return;
    }

    setLoading(true);
    onSavingChange?.(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/partners/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minimumPayoutAmount,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Ayarlar kaydedilemedi.");
        return;
      }

      setMessage("Ayarlar başarıyla güncellendi.");
      setForm(json.data.settings);
      setMinPayoutInput(formatMoneyInput(json.data.settings.minimumPayoutAmount));
    } catch {
      setError("Ayarlar kaydedilirken hata oluştu.");
    } finally {
      setLoading(false);
      onSavingChange?.(false);
    }
  }

  return (
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
        title="Komisyon Ayarları"
        description="Partnerlerin satış ve yenilemelerden kazanacağı varsayılan oranları belirleyin."
        icon={Percent}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminFormField
            label="Varsayılan komisyon oranı"
            helper="Yeni partnerler için geçerli yüzde oranı."
          >
            <div className="relative">
              <AdminTextInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.defaultCommissionRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultCommissionRate: Number(e.target.value),
                  })
                }
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">
                %
              </span>
            </div>
          </AdminFormField>
        </div>
        <AdminToggleRow
          label="Yenilemelerde komisyon ver"
          description="Abonelik yenilemelerinde partner komisyonu hesaplanır."
          checked={form.commissionOnRenewals}
          onChange={(checked) =>
            setForm({ ...form, commissionOnRenewals: checked })
          }
        />
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Ödeme Ayarları"
        description="Partner ödemeleri için minimum tutar ve para birimi kuralları."
        icon={Wallet}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminFormField
            label="Minimum ödeme tutarı"
            helper="Partner bakiyesi bu tutara ulaştığında ödeme talep edilebilir."
          >
            <div className="relative">
              <AdminTextInput
                value={minPayoutInput}
                onChange={(e) => setMinPayoutInput(e.target.value)}
                inputMode="decimal"
                placeholder="500,00"
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">
                TL
              </span>
            </div>
          </AdminFormField>
          <AdminFormField
            label="Varsayılan para birimi"
            helper="Partner ödemeleri Türk Lirası üzerinden yapılır."
          >
            <AdminTextInput value="TRY (₺)" disabled readOnly />
          </AdminFormField>
        </div>
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Dönüşüm Kuralları"
        description="Cookie süresi ve dönüşüm onay politikalarını yönetin."
        icon={Cookie}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <AdminFormField
            label="Cookie süresi"
            helper="Referans linkinden sonra dönüşümün sayılacağı süre."
          >
            <div className="relative">
              <AdminTextInput
                type="number"
                min={1}
                max={365}
                value={form.cookieDurationDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cookieDurationDays: Number(e.target.value),
                  })
                }
                className="pr-14"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">
                gün
              </span>
            </div>
          </AdminFormField>
        </div>
        <AdminToggleRow
          label="Dönüşümleri otomatik onayla"
          description="Manuel inceleme olmadan uygun dönüşümler onaylanır."
          checked={form.autoApproveConversions}
          onChange={(checked) =>
            setForm({ ...form, autoApproveConversions: checked })
          }
        />
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Başvuru Ayarları"
        description="Partner başvurularının kabul edilip edilmeyeceğini yönetin."
        icon={UserPlus}
      >
        <AdminToggleRow
          label="Başvurular açık"
          description="Yeni partner başvuruları platform üzerinden alınabilir."
          checked={form.isApplicationOpen}
          onChange={(checked) =>
            setForm({ ...form, isApplicationOpen: checked })
          }
        />
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Şartlar ve Koşullar"
        description="Partner başvuru ve sözleşme sayfasında gösterilecek metin."
        icon={FileText}
      >
        <AdminFormField
          label="Şartlar metni"
          helper="Markdown veya düz metin olarak partner şartlarını yazın."
        >
          <AdminTextarea
            value={form.termsText ?? ""}
            onChange={(e) => setForm({ ...form, termsText: e.target.value })}
            placeholder="Partner programı şartları..."
          />
        </AdminFormField>
      </AdminSettingsSection>

      {showFooterSave ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={appPrimaryButtonClass}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Değişiklikleri Kaydet
          </button>
        </div>
      ) : null}
    </form>
  );
}
