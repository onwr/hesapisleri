"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { AdminPlanRowActions } from "@/components/admin/plans/admin-plan-row-actions";
import { formatAdminDate } from "@/lib/admin-utils";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";

type PlanPeriodRow = {
  billingInterval: string;
  salePriceMinor: number;
  currency: string;
};

type PlanRow = {
  id: string;
  name: string;
  code: string;
  shortDescription: string | null;
  planStatus: string;
  planStatusLabel: string;
  planStatusClass: string;
  isActiveLegacy: boolean;
  activeSubscriptionCount: number;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  periods?: PlanPeriodRow[];
  priceCurrency: string;
  trialLabel: string;
  updatedAt: string;
  issues: Array<{ code: string; label: string; severity: string }>;
};

type Props = {
  list: {
    items: PlanRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    archivedCount?: number;
  };
  query: { page: number; pageSize: number; q?: string; planStatus?: string };
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

function formatPeriods(periods: PlanPeriodRow[] | undefined) {
  if (!periods || periods.length === 0) return "Fiyat tanımlanmamış";
  return periods
    .map((p) => {
      const label = INTERVAL_LABELS[p.billingInterval] ?? p.billingInterval;
      const value = (p.salePriceMinor / 100).toLocaleString("tr-TR", {
        style: "currency",
        currency: p.currency || "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${label}: ${value}`;
    })
    .join(" · ");
}

export function AdminPlansListShell({ list, query }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-slate-700">
        <p className="font-black text-[#0f1f4d]">Plan yönetimi nasıl çalışır?</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>
            <strong>Düzenle</strong> planı silmez; yeni fiyat sürümü yayınlar. Mevcut aboneler
            kilitli fiyatla devam edebilir.
          </li>
          <li>
            <strong>Arşivle</strong> yeni satışı kapatır; geçmiş abonelik ve ödemeler korunur.
          </li>
          <li>
            <strong>Sil</strong> yalnız hiç kullanılmamış taslak planlarda mümkündür; aksi halde
            arşivleyin.
          </li>
          <li>
            <strong>Kopyala</strong> yeni taslak plan oluşturur; kaynak plana dokunmaz.
          </li>
        </ul>
      </div>

      <div className={`${appPanelClass} p-3`}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 text-[12px] text-slate-600">
            Ara
            <input
              className="mt-1 h-9 w-full rounded border px-2 text-[12px]"
              defaultValue={query.q ?? ""}
              placeholder="Plan adı veya kodu"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const q = (e.target as HTMLInputElement).value;
                const params = new URLSearchParams(window.location.search);
                if (q) params.set("q", q);
                else params.delete("q");
                router.push(`/admin/plans?${params.toString()}`);
              }}
            />
          </label>
          <label className="text-[12px] text-slate-600">
            Durum
            <select
              className="mt-1 h-9 rounded border px-2 text-[12px]"
              defaultValue={query.planStatus ?? "ALL"}
              onChange={(e) => {
                const params = new URLSearchParams(window.location.search);
                const v = e.target.value;
                if (v === "ALL") params.delete("planStatus");
                else params.set("planStatus", v);
                router.push(`/admin/plans?${params.toString()}`);
              }}
            >
              <option value="NOT_ARCHIVED">Aktif/Pasif/Taslak</option>
              <option value="ALL">Tümü</option>
              <option value="ACTIVE">Aktif</option>
              <option value="DRAFT">Taslak</option>
              <option value="ARCHIVED">Arşivlenmiş</option>
            </select>
          </label>
          <button
            type="button"
            className={`${appOutlineButtonClass} h-9 gap-1.5`}
            onClick={() => router.refresh()}
          >
            <RefreshCw size={14} />
            Planları Yenile
          </button>
        </div>
      </div>

      <div className={`${appPanelClass} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-600">
          <span>
            {list.total} plan · sayfa {list.page}/{list.totalPages || 1}
          </span>
          {list.archivedCount ? (
            <span className="text-slate-500">
              {list.archivedCount} arşivlenmiş plan
            </span>
          ) : null}
        </div>

        {list.items.length === 0 ? (
          <p className="text-[12px] text-slate-500">Henüz bir üyelik planı oluşturulmadı.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={appTableClass}>
                <thead>
                  <tr className={appTableHeadClass}>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Dönemler</th>
                    <th className="px-3 py-2">Abone</th>
                    <th className="px-3 py-2">Deneme</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Güncelleme</th>
                    <th className="px-3 py-2">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((plan) => (
                    <tr key={plan.id} className={appTableRowClass}>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/plans/${plan.id}`}
                          className="font-bold text-slate-900 hover:underline"
                        >
                          {plan.name}
                        </Link>
                        {plan.shortDescription ? (
                          <p className="text-[11px] text-slate-500">{plan.shortDescription}</p>
                        ) : null}
                        <p className="font-mono text-[10px] text-slate-400">{plan.code}</p>
                        {plan.issues.length > 0 ? (
                          <p className="mt-1 text-[10px] text-amber-700">
                            {plan.issues.map((i) => i.label).join(" · ")}
                          </p>
                        ) : null}
                        {plan.planStatus === "ARCHIVED" ? (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Bu plan geçmiş abonelik ve ödeme kayıtlarıyla bağlantılıdır.
                            Finansal geçmişi korumak için tamamen silinemez.
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[11px]">
                        {formatPeriods(plan.periods)}
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {plan.activeSubscriptionCount}
                        {plan.planStatus === "ARCHIVED" && plan.activeSubscriptionCount > 0 ? (
                          <span className="ml-1 text-[10px] text-slate-500">
                            aktif abonelik
                          </span>
                        ) : null}
                        {plan.planStatus === "ARCHIVED" ? (
                          <p className="text-[10px] text-slate-400">
                            Finansal geçmiş nedeniyle silinemez
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[12px]">{plan.trialLabel}</td>
                      <td className="px-3 py-3">
                        <span
                          className={[
                            "rounded-md px-2 py-0.5 text-[11px] font-bold",
                            plan.planStatusClass,
                          ].join(" ")}
                        >
                          {plan.planStatusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-600">
                        {formatAdminDate(plan.updatedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <AdminPlanRowActions
                          plan={{
                            id: plan.id,
                            name: plan.name,
                            planStatus: plan.planStatus,
                            isActive: plan.isActiveLegacy,
                            activeSubscriptionCount: plan.activeSubscriptionCount,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 md:hidden">
              {list.items.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/plans/${plan.id}`}
                        className="text-[13px] font-bold text-slate-900"
                      >
                        {plan.name}
                      </Link>
                      <p className="text-[11px] text-slate-500">
                        {formatPeriods(plan.periods)}
                      </p>
                    </div>
                    <AdminPlanRowActions
                      plan={{
                        id: plan.id,
                        name: plan.name,
                        planStatus: plan.planStatus,
                        isActive: plan.isActiveLegacy,
                        activeSubscriptionCount: plan.activeSubscriptionCount,
                      }}
                      onMigrated={() => router.refresh()}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600">
                    <span className={plan.planStatusClass + " rounded px-1.5 py-0.5 font-bold"}>
                      {plan.planStatusLabel}
                    </span>
                    <span>{plan.activeSubscriptionCount} abone</span>
                    <span>Deneme: {plan.trialLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminPlansListActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/plans/new" className={`${appPrimaryButtonClass} h-9`}>
        Yeni Plan Ekle
      </Link>
    </div>
  );
}
