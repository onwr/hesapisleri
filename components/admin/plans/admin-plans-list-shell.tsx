"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import { CreditCard, Layers, ShoppingCart, Users } from "lucide-react";
import {
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";

type PlanRow = {
  id: string;
  name: string;
  code: string;
  shortDescription: string | null;
  planStatusLabel: string;
  planStatusClass: string;
  pricingClassLabel: string;
  checkoutAvailable: boolean;
  activeSubscriptionCount: number;
  mrrByCurrency: Record<string, number>;
  issues: Array<{ code: string; label: string; severity: string }>;
};

type Props = {
  list: {
    items: PlanRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  metrics: {
    totalPlans: number;
    statusCounts: { DRAFT: number; ACTIVE: number; ARCHIVED: number };
    checkoutAvailableCount: number;
    activeSubscriptionCount: number;
    mrr: Record<string, number>;
  };
  query: { page: number; pageSize: number };
};

function formatMrr(mrr: Record<string, number>) {
  const parts = Object.entries(mrr).map(([cur, v]) => `${v.toLocaleString("tr-TR")} ${cur}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function AdminPlansListShell({ list, metrics, query }: Props) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Aktif Plan"
          value={String(metrics.statusCounts.ACTIVE)}
          icon={CreditCard}
          tone="green"
        />
        <AdminStatCard
          title="Toplam Plan"
          value={String(metrics.totalPlans)}
          icon={Layers}
          tone="blue"
        />
        <AdminStatCard
          title="Checkout Açık"
          value={String(metrics.checkoutAvailableCount)}
          icon={ShoppingCart}
          tone="amber"
        />
        <AdminStatCard
          title="Aktif Abonelik"
          value={String(metrics.activeSubscriptionCount)}
          icon={Users}
          tone="purple"
        />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-600">
          <span>
            {list.total} plan · sayfa {list.page}/{list.totalPages}
          </span>
          <span>MRR: {formatMrr(metrics.mrr)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Fiyat sınıfı</th>
                <th className="px-3 py-2">Checkout</th>
                <th className="px-3 py-2">Abonelik</th>
                <th className="px-3 py-2">MRR</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((plan) => (
                <tr key={plan.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-900">{plan.name}</p>
                    {plan.shortDescription ? (
                      <p className="text-[11px] text-slate-500">{plan.shortDescription}</p>
                    ) : null}
                    {plan.issues.length > 0 ? (
                      <p className="mt-1 text-[10px] text-amber-700">
                        {plan.issues.map((i) => i.label).join(" · ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-slate-600">{plan.code}</td>
                  <td className="px-3 py-3">
                    <span
                      className={["rounded-md px-2 py-0.5 text-[11px] font-bold", plan.planStatusClass].join(
                        " "
                      )}
                    >
                      {plan.planStatusLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-700">{plan.pricingClassLabel}</td>
                  <td className="px-3 py-3 text-[12px]">
                    {plan.checkoutAvailable ? (
                      <span className="font-bold text-emerald-700">Açık</span>
                    ) : (
                      <span className="text-slate-500">Kapalı</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-700">
                    {plan.activeSubscriptionCount}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-700">
                    {formatMrr(plan.mrrByCurrency)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/plans/${plan.id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-700 hover:underline"
                    >
                      Detay
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
