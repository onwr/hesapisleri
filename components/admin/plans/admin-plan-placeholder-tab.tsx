"use client";

import { appPanelClass } from "@/lib/admin-ui";
import type { AdminPlanTab } from "@/lib/admin/plans/admin-plan-schemas";

const LABELS: Record<string, string> = {
  features: "Özellikler",
  entitlements: "Yetkiler",
  subscriptions: "Abonelikler",
  history: "Geçmiş",
  notes: "Notlar",
};

export function AdminPlanPlaceholderTab({ tab }: { tab: AdminPlanTab }) {
  return (
    <div className={`${appPanelClass} p-6 text-center`}>
      <p className="text-[13px] font-bold text-slate-800">{LABELS[tab] ?? tab}</p>
      <p className="mt-2 text-[12px] text-slate-600">
        Bu bölüm sonraki yönetim fazında tamamlanacaktır.
      </p>
    </div>
  );
}
