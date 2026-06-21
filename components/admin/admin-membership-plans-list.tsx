import Link from "next/link";
import { ChevronRight, CreditCard, Layers, Tag, Ticket } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatMoney } from "@/lib/format-utils";

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  currency: string;
  isActive: boolean;
  features: string[];
  prices: {
    MONTHLY: number;
    QUARTERLY: number;
    SEMI_ANNUAL: number;
    YEARLY: number;
  };
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

export function AdminMembershipPlansList({ plans }: { plans: Plan[] }) {
  const activePlans = plans.filter((p) => p.isActive).length;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Aktif Plan"
          value={String(activePlans)}
          icon={CreditCard}
          tone="green"
        />
        <AdminStatCard
          title="Toplam Plan"
          value={String(plans.length)}
          icon={Layers}
          tone="blue"
        />
        <AdminStatCard
          title="Aktif Kampanya"
          value="—"
          icon={Tag}
          tone="amber"
        />
        <AdminStatCard
          title="Aktif Kupon"
          value="—"
          icon={Ticket}
          tone="purple"
        />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Aylık</th>
                <th className="px-3 py-2">3 Aylık</th>
                <th className="px-3 py-2">6 Aylık</th>
                <th className="px-3 py-2">Yıllık</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-900">{plan.name}</p>
                    {plan.description ? (
                      <p className="text-[11px] text-slate-500">{plan.description}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-slate-600">
                    {plan.code}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatMoney(plan.prices.MONTHLY)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatMoney(plan.prices.QUARTERLY)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatMoney(plan.prices.SEMI_ANNUAL)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatMoney(plan.prices.YEARLY)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={[
                        "rounded-md px-2 py-0.5 text-[11px] font-bold",
                        plan.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {plan.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/membership-plans/${plan.id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-700 hover:underline"
                    >
                      Düzenle
                      <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
