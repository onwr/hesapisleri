"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AdminPlatformSettingsForm } from "@/components/admin/admin-platform-settings-form";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";

type SettingsDetail = {
  settings: {
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
  policyNotes: {
    historicalData: string;
    registration: string;
    maintenance: string;
  };
};

type EnvGroup = {
  provider: string;
  mode?: string;
  configured: boolean;
  missing: string[];
  invalid: string[];
};

type HistoryRow = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  reason: string | null;
  changedFields: string[];
  versionBefore: number | null;
  versionAfter: number | null;
  user: { id: string; name: string | null; email: string } | null;
};

function envStatusLabel(group: EnvGroup) {
  if (group.configured) return "Yapılandırılmış";
  if (group.invalid.length) return "Geçersiz";
  if (group.missing.length) return "Eksik";
  return "Bilinmiyor";
}

function envBadgeClass(group: EnvGroup) {
  if (group.configured) return "bg-emerald-100 text-emerald-800";
  if (group.invalid.length) return "bg-rose-100 text-rose-800";
  if (group.missing.length) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function AdminPlatformSettingsContent({
  initial,
  history,
  environment,
}: {
  initial: SettingsDetail;
  history: HistoryRow[];
  environment: Record<string, EnvGroup>;
}) {
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(initial);
  const [historyRows] = useState(history);

  return (
    <>
      <AdminPageHeader
        title="Platform Ayarları"
        description="Platform genelinde kullanılan güvenli ayarları yönetin. Değişiklikler yalnız gelecekteki işlemlere uygulanır."
        primaryAction={
          <button
            type="submit"
            form="platform-settings-form"
            disabled={saving}
            className={appPrimaryButtonClass}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Kaydet
          </button>
        }
      />

      <div className={`${appPanelClass} mb-6 space-y-2 p-4 text-[13px] text-slate-700`}>
        <h2 className="font-bold text-slate-900">Politika notları</h2>
        <p>{detail.policyNotes.historicalData}</p>
        <p>{detail.policyNotes.registration}</p>
        <p>{detail.policyNotes.maintenance}</p>
        <p className="text-[12px] text-slate-500">
          Sürüm: {detail.settings.version} · Son güncelleme:{" "}
          {formatAdminDateTime(detail.settings.updatedAt)}
        </p>
      </div>

      <AdminPlatformSettingsForm
        initial={detail.settings}
        onSavingChange={setSaving}
        onSaved={(next) => {
          setDetail((prev) => ({ ...prev, settings: next }));
        }}
      />

      <div className={`${appPanelClass} mt-6 p-4`}>
        <h2 className="mb-3 font-bold text-slate-900">Environment / provider durumu</h2>
        <p className="mb-4 text-[12px] text-slate-500">
          Salt okunur — credential değerleri gösterilmez.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(environment).map(([key, group]) => (
            <div key={key} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold capitalize text-slate-800">{key}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${envBadgeClass(group)}`}
                >
                  {envStatusLabel(group)}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-slate-600">
                Provider: {group.provider}
                {group.mode ? ` · ${group.mode}` : ""}
              </p>
              {group.missing.length ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  Eksik: {group.missing.join(", ")}
                </p>
              ) : null}
              {group.invalid.length ? (
                <p className="mt-1 text-[11px] text-rose-700">
                  Geçersiz: {group.invalid.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className={`${appPanelClass} mt-6 p-4`}>
        <h2 className="mb-3 font-bold text-slate-900">Son değişiklikler</h2>
        {historyRows.length ? (
          <ul className="space-y-3">
            {historyRows.map((row) => (
              <li key={row.id} className="border-b border-slate-50 pb-3 last:border-0">
                <p className="text-[13px] font-semibold text-slate-800">
                  {formatAdminDateTime(row.createdAt)} ·{" "}
                  {row.user?.name ?? row.user?.email ?? "Sistem"}
                </p>
                <p className="font-mono text-[11px] text-slate-500">{row.action}</p>
                {row.versionBefore != null && row.versionAfter != null ? (
                  <p className="text-[11px] text-slate-500">
                    Sürüm: {row.versionBefore} → {row.versionAfter}
                  </p>
                ) : null}
                {row.changedFields.length ? (
                  <p className="text-[12px] text-slate-600">
                    Alanlar: {row.changedFields.join(", ")}
                  </p>
                ) : null}
                {row.reason ? (
                  <p className="text-[12px] text-slate-600">Gerekçe: {row.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-slate-500">Henüz kayıtlı değişiklik yok.</p>
        )}
      </div>
    </>
  );
}
