"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cookie, FileText, Info, Percent, UserPlus, Wallet } from "lucide-react";
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
  defaultCommissionRate: number;
  cookieDurationDays: number;
  minimumPayoutAmount: number;
  autoApproveConversions: boolean;
  commissionOnRenewals: boolean;
  isApplicationOpen: boolean;
  termsText: string | null;
  updatedAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  defaultCommissionRate: "Varsayılan komisyon",
  cookieDurationDays: "Cookie süresi",
  minimumPayoutAmount: "Minimum ödeme",
  autoApproveConversions: "Otomatik onay",
  commissionOnRenewals: "Yenileme komisyonu",
  isApplicationOpen: "Başvurular açık",
  termsText: "Şartlar metni",
};

function hasCriticalChanges(initial: Settings, next: Settings, minPayout: number) {
  return (
    initial.defaultCommissionRate !== next.defaultCommissionRate ||
    initial.cookieDurationDays !== next.cookieDurationDays ||
    initial.minimumPayoutAmount !== minPayout ||
    initial.autoApproveConversions !== next.autoApproveConversions ||
    initial.commissionOnRenewals !== next.commissionOnRenewals ||
    initial.isApplicationOpen !== next.isApplicationOpen
  );
}

function diffFields(initial: Settings, next: Settings, minPayout: number) {
  const fields: string[] = [];
  if (initial.defaultCommissionRate !== next.defaultCommissionRate) fields.push("defaultCommissionRate");
  if (initial.cookieDurationDays !== next.cookieDurationDays) fields.push("cookieDurationDays");
  if (initial.minimumPayoutAmount !== minPayout) fields.push("minimumPayoutAmount");
  if (initial.autoApproveConversions !== next.autoApproveConversions) fields.push("autoApproveConversions");
  if (initial.commissionOnRenewals !== next.commissionOnRenewals) fields.push("commissionOnRenewals");
  if (initial.isApplicationOpen !== next.isApplicationOpen) fields.push("isApplicationOpen");
  if ((initial.termsText ?? "") !== (next.termsText ?? "")) fields.push("termsText");
  return fields;
}

export function AdminPartnerSettingsForm({
  initial,
  formId = "partner-settings-form",
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
  const [minPayoutInput, setMinPayoutInput] = useState(formatMoneyInput(initial.minimumPayoutAmount));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pendingMinPayout, setPendingMinPayout] = useState<number | null>(null);

  function validateLocal(minPayout: number): string | null {
    if (minPayout < 0) return "Minimum ödeme tutarı negatif olamaz.";
    if (form.defaultCommissionRate < 0 || form.defaultCommissionRate > 100) {
      return "Komisyon oranı 0–100 arasında olmalıdır.";
    }
    if (form.cookieDurationDays < 1 || form.cookieDurationDays > 365) {
      return "Attribution süresi 1–365 gün arasında olmalıdır.";
    }
    return null;
  }

  async function submit(reasonText: string) {
    if (loading) return;
    const minimumPayoutAmount = pendingMinPayout ?? parseTurkishMoneyInput(minPayoutInput);
    if (minimumPayoutAmount === null) {
      setError("Minimum ödeme tutarı geçerli bir değer olmalıdır.");
      return;
    }
    const localError = validateLocal(minimumPayoutAmount);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    onSavingChange?.(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/partners/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCommissionRate: form.defaultCommissionRate,
          cookieDurationDays: form.cookieDurationDays,
          minimumPayoutAmount,
          autoApproveConversions: form.autoApproveConversions,
          commissionOnRenewals: form.commissionOnRenewals,
          isApplicationOpen: form.isApplicationOpen,
          termsText: form.termsText,
          reason: reasonText.trim(),
          confirm: true,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Ayarlar kaydedilemedi.");
        return;
      }

      const next = json.data.settings as Settings;
      setMessage("Ayarlar başarıyla güncellendi.");
      setForm(next);
      setMinPayoutInput(formatMoneyInput(next.minimumPayoutAmount));
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
      setPendingMinPayout(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const minimumPayoutAmount = parseTurkishMoneyInput(minPayoutInput);
    if (minimumPayoutAmount === null) {
      setError("Minimum ödeme tutarı geçerli bir değer olmalıdır.");
      return;
    }
    const localError = validateLocal(minimumPayoutAmount);
    if (localError) {
      setError(localError);
      return;
    }

    const fields = diffFields(initial, form, minimumPayoutAmount);
    if (!fields.length) {
      setError("Kaydedilecek değişiklik yok.");
      return;
    }

    setPendingMinPayout(minimumPayoutAmount);
    setConfirmOpen(true);
  }

  const pendingFields = pendingMinPayout != null
    ? diffFields(initial, form, pendingMinPayout)
    : diffFields(initial, form, parseTurkishMoneyInput(minPayoutInput) ?? initial.minimumPayoutAmount);

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
          title="Program durumu"
          description="Başvuru kabulü ve referral davranışı hakkında bilgi."
          icon={Info}
        >
          <AdminToggleRow
            label="Partner başvuruları açık"
            description="Kapalıyken yeni başvuru alınmaz; mevcut partner ve geçmiş veriler korunur."
            checked={form.isApplicationOpen}
            onChange={(checked) => setForm({ ...form, isApplicationOpen: checked })}
          />
          <p className="text-[12px] text-slate-500">
            Referral linkleri ACTIVE partner profilleri için çalışmaya devam eder. Tüm programı
            kapatma için ayrı model alanı yoktur.
          </p>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Varsayılan komisyon"
          description="Yeni onaylanan partnerler için başlangıç oranı. Mevcut partner özel oranı önceliklidir."
          icon={Percent}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <AdminFormField label="Varsayılan komisyon oranı" helper="0–100 arası.">
              <AdminTextInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.defaultCommissionRate}
                onChange={(e) =>
                  setForm({ ...form, defaultCommissionRate: Number(e.target.value) })
                }
              />
            </AdminFormField>
          </div>
          <AdminToggleRow
            label="Yenilemelerde komisyon ver"
            description="Gelecekteki yenileme ödemelerinde komisyon hesaplanır."
            checked={form.commissionOnRenewals}
            onChange={(checked) => setForm({ ...form, commissionOnRenewals: checked })}
          />
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Attribution / referral süresi"
          description="Referans cookie süresi (gün). Geçmiş attribution kayıtları değişmez."
          icon={Cookie}
        >
          <AdminFormField label="Cookie süresi">
            <AdminTextInput
              type="number"
              min={1}
              max={365}
              value={form.cookieDurationDays}
              onChange={(e) =>
                setForm({ ...form, cookieDurationDays: Number(e.target.value) })
              }
            />
          </AdminFormField>
          <AdminToggleRow
            label="Dönüşümleri otomatik onayla"
            description="Yeni dönüşümler manuel inceleme olmadan onaylanabilir."
            checked={form.autoApproveConversions}
            onChange={(checked) => setForm({ ...form, autoApproveConversions: checked })}
          />
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Payout alt limiti"
          description="Global minimum ödeme tutarı (TRY). Partner özel payout limiti modelde yok."
          icon={Wallet}
        >
          <AdminFormField label="Minimum ödeme tutarı">
            <AdminTextInput
              value={minPayoutInput}
              onChange={(e) => setMinPayoutInput(e.target.value)}
              inputMode="decimal"
              placeholder="500,00"
            />
          </AdminFormField>
          <p className="text-[12px] text-slate-500">
            Ödeme yöntemi partner profilinde (payoutMethod) tanımlanır; global payout dönemi ayarı
            yoktur.
          </p>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Başvuru metinleri"
          description="Partner başvuru sayfasında gösterilen şartlar."
          icon={UserPlus}
        >
          <AdminFormField label="Şartlar metni">
            <AdminTextarea
              value={form.termsText ?? ""}
              onChange={(e) => setForm({ ...form, termsText: e.target.value || null })}
            />
          </AdminFormField>
        </AdminSettingsSection>

        <AdminSettingsSection
          title="Partner özel değerler"
          description="Bu fazda toplu partner güncellemesi yapılmaz."
          icon={FileText}
        >
          <p className="text-[13px] text-slate-600">
            Komisyon hesaplamasında <code>PartnerProfile.commissionRate</code> kullanılır. Özel
            oran yoksa global varsayılan yalnız yeni partner onayında başlangıç değeri olarak
            uygulanır; geçmiş earning/conversion yeniden hesaplanmaz.
          </p>
        </AdminSettingsSection>
      </form>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md space-y-4 p-5`}>
            <h3 className="text-lg font-bold text-slate-800">Ayar değişikliğini onayla</h3>
            <p className="text-[13px] text-slate-600">
              Değişecek alanlar:{" "}
              {pendingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
            </p>
            {hasCriticalChanges(initial, form, pendingMinPayout ?? initial.minimumPayoutAmount) ? (
              <p className="text-[12px] font-semibold text-amber-700">
                Kritik ayar değişikliği — geçmiş earning/payout/conversion etkilenmez.
              </p>
            ) : null}
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
                  setPendingMinPayout(null);
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
