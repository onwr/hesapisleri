"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AdminPartnerSettingsForm } from "@/components/admin/admin-partner-settings-form";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";

type SettingsDetail = {
  settings: {
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
  overridePriority: Record<string, string>;
  programNotes: Record<string, string>;
  overrideStats: {
    partnersWithCustomCommission: number;
    partnersWithPayoutMethod: number;
  };
};

type HistoryRow = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  reason: string | null;
  changedFields: string[];
  user: { id: string; name: string | null; email: string } | null;
};

export function AdminPartnerSettingsContent({
  initial,
  history,
}: {
  initial: SettingsDetail;
  history: HistoryRow[];
}) {
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(initial);
  const [historyRows, setHistoryRows] = useState(history);

  return (
    <>
      <AdminPageHeader
        title="Ortaklık Ayarları"
        description="Partner programı global kurallarını yönetin. Değişiklikler yalnız gelecekteki işlemlere uygulanır."
        primaryAction={
          <button
            type="submit"
            form="partner-settings-form"
            disabled={saving}
            className={appPrimaryButtonClass}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Kaydet
          </button>
        }
        secondaryActions={
          <a href="/admin/partners" className={appOutlineButtonClass}>
            Partner listesi
          </a>
        }
      />

      <div className={`${appPanelClass} mb-6 space-y-3 p-4 text-[13px] text-slate-700`}>
        <h2 className="font-bold text-slate-900">Program ve öncelik</h2>
        <p>
          <span className="font-semibold">Başvuru:</span>{" "}
          {detail.settings.isApplicationOpen ? "Açık" : "Kapalı"} (
          <code className="text-[12px]">isApplicationOpen</code>)
        </p>
        <p className="text-slate-600">{detail.programNotes.referralContinues}</p>
        <p className="text-slate-600">{detail.programNotes.historicalData}</p>
        <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
          {Object.entries(detail.overridePriority).map(([key, value]) => (
            <div key={key}>
              <p className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
              <p className="text-slate-600">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate-500">
          Özel komisyonlu partner: {detail.overrideStats.partnersWithCustomCommission} · Özel ödeme
          yöntemi: {detail.overrideStats.partnersWithPayoutMethod}
        </p>
      </div>

      <AdminPartnerSettingsForm
        initial={detail.settings}
        onSavingChange={setSaving}
        onSaved={(next) => {
          setDetail((prev) => ({ ...prev, settings: next }));
        }}
      />

      <div className={`${appPanelClass} mt-6 p-4`}>
        <h2 className="mb-3 font-bold text-slate-900">Son değişiklikler</h2>
        {historyRows.length ? (
          <ul className="space-y-3">
            {historyRows.map((row) => (
              <li key={row.id} className="border-b border-slate-50 pb-3 last:border-0">
                <p className="text-[13px] font-semibold text-slate-800">
                  {formatAdminDateTime(row.createdAt)} · {row.user?.name ?? row.user?.email ?? "Sistem"}
                </p>
                <p className="font-mono text-[11px] text-slate-500">{row.action}</p>
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
