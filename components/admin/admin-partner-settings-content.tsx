"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { AdminPartnerSettingsForm } from "@/components/admin/admin-partner-settings-form";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appPrimaryButtonClass } from "@/lib/admin-ui";

type Settings = {
  defaultCommissionRate: number;
  cookieDurationDays: number;
  minimumPayoutAmount: number;
  autoApproveConversions: boolean;
  commissionOnRenewals: boolean;
  isApplicationOpen: boolean;
  termsText: string | null;
};

export function AdminPartnerSettingsContent({
  initial,
}: {
  initial: Settings;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <>
      <AdminPageHeader
        title="Ortaklık Ayarları"
        description="Komisyon, ödeme, çerez ve başvuru kurallarını yönetin."
        primaryAction={
          <button
            type="submit"
            form="partner-settings-form"
            disabled={saving}
            className={appPrimaryButtonClass}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Kaydet
          </button>
        }
      />
      <AdminPartnerSettingsForm
        initial={initial}
        onSavingChange={setSaving}
      />
    </>
  );
}
