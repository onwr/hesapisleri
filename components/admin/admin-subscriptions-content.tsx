import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  Clock,
  PauseCircle,
  RefreshCcw,
  TimerReset,
  Wallet,
} from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import { AdminSubscriptionFilters } from "@/components/admin/admin-subscription-filters";
import { AdminSubscriptionRowActions } from "@/components/admin/admin-subscription-row-actions";
import {
  appOutlineButtonClass,
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, getCompanyStatusClass, getCompanyStatusLabel } from "@/lib/admin-utils";
import {
  formatBillingInterval,
  getAdminPriceSourceLabel,
  getSubscriptionStatusBadgeClass,
  getSubscriptionStatusUiLabel,
  type AdminSubscriptionListFilters,
} from "@/lib/admin-subscription-utils";
import type {
  getAdminSubscriptionsSummary,
  listAdminSubscriptions,
} from "@/lib/admin-subscription-service";

type ListData = Awaited<ReturnType<typeof listAdminSubscriptions>>;
type SummaryData = Awaited<ReturnType<typeof getAdminSubscriptionsSummary>>;

type Plan = { id: string; name: string };
type Partner = { id: string; fullName: string; referralCode: string };

type AdminSubscriptionsContentProps = {
  list: ListData;
  summary: SummaryData;
  filters: AdminSubscriptionListFilters;
  plans: Plan[];
  partners?: Partner[];
};

export function AdminSubscriptionsContent({
  list,
  summary,
  filters,
  plans,
  partners = [],
}: AdminSubscriptionsContentProps) {
  const { items, pagination } = list;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Abonelikler"
        description="Firma üyeliklerini, yenilemeleri, deneme sürelerini ve ödeme durumlarını yönetin."
        secondaryActions={
          <button type="button" className={appOutlineButtonClass} disabled title="Yakında">
            Dışa Aktar
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          title="Toplam Abonelik"
          value={String(summary.total)}
          icon={BadgeCheck}
          tone="blue"
        />
        <AdminStatCard
          title="Aktif"
          value={String(summary.active)}
          icon={BadgeCheck}
          tone="green"
          href="/admin/subscriptions?status=ACTIVE"
        />
        <AdminStatCard
          title="Deneme"
          value={String(summary.trial)}
          icon={TimerReset}
          tone="purple"
          href="/admin/subscriptions?trial=true"
        />
        <AdminStatCard
          title="Ödeme Gecikti"
          value={String(summary.pastDue)}
          icon={CircleAlert}
          tone="amber"
          href="/admin/subscriptions?status=PAST_DUE"
        />
        <AdminStatCard
          title="Ek Süre"
          value={String(summary.gracePeriod)}
          icon={Clock}
          tone="amber"
          href="/admin/subscriptions?grace=true"
        />
        <AdminStatCard
          title="Bu Ay Yenilenecek"
          value={String(summary.renewingThisMonth)}
          icon={CalendarClock}
          tone="blue"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Askıda"
          value={String(summary.suspended)}
          icon={PauseCircle}
          tone="red"
          href="/admin/subscriptions?status=SUSPENDED"
        />
        <AdminStatCard
          title="Dönem Sonu İptal"
          value={String(summary.cancelAtPeriodEnd)}
          icon={RefreshCcw}
          tone="neutral"
          href="/admin/subscriptions?status=CANCEL_AT_PERIOD_END"
        />
        <AdminStatCard
          title="Auto-renew Açık"
          value={String(summary.autoRenewOn)}
          icon={RefreshCcw}
          tone="green"
          href="/admin/subscriptions?autoRenew=true"
        />
        <AdminStatCard
          title="Ödeme Yöntemi Eksik"
          value={String(summary.missingPaymentMethod)}
          icon={Wallet}
          tone="red"
          href="/admin/subscriptions?autoRenew=true&hasPaymentMethod=false"
        />
      </div>

      <AdminSubscriptionFilters filters={filters} plans={plans} partners={partners} />

      {items.length === 0 ? (
        <div className={`${appPanelClass} px-6 py-16 text-center`}>
          <p className="text-[15px] font-bold text-[#0f1f4d]">
            Henüz abonelik kaydı bulunmuyor.
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            Filtreleri temizleyerek tekrar deneyin.
          </p>
        </div>
      ) : (
        <>
          <div className={`${appPanelClass} hidden overflow-x-auto p-4 md:block`}>
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Dönem</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Ödenen Fiyat</th>
                  <th className="px-3 py-2">Yenileme Fiyatı</th>
                  <th className="px-3 py-2">Fiyat Kaynağı</th>
                  <th className="px-3 py-2">Auto-renew</th>
                  <th className="px-3 py-2">Başlangıç</th>
                  <th className="px-3 py-2">Bitiş</th>
                  <th className="px-3 py-2">Sonraki Ödeme</th>
                  <th className="px-3 py-2">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`${appTableRowClass} align-top`}>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/subscriptions/${item.id}`}
                        className="font-extrabold text-[#0f1f4d] hover:underline"
                      >
                        {item.companyName}
                      </Link>
                      <p className="text-[11px] text-slate-500">{item.ownerEmail}</p>
                      <span
                        className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${getCompanyStatusClass(item.companyStatus)}`}
                      >
                        {getCompanyStatusLabel(item.companyStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.planName}
                      {item.planVersion ? (
                        <p className="text-[11px] text-slate-400">v{item.planVersion}</p>
                      ) : null}
                      {item.isGrandfathered ? (
                        <span className="mt-1 inline-block rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          Grandfathered
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatBillingInterval(item.billingInterval)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getSubscriptionStatusBadgeClass(item.status)}`}
                      >
                        {getSubscriptionStatusUiLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {item.paidPriceFormatted}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {item.renewalPriceFormatted}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-600">
                      {getAdminPriceSourceLabel(item.priceSource)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          item.autoRenew
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.autoRenew ? "Açık" : "Kapalı"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(item.currentPeriodStart)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(item.currentPeriodEnd)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(item.nextBillingAt)}
                    </td>
                    <td className="px-3 py-3">
                      <AdminSubscriptionRowActions item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div key={item.id} className={`${appPanelClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-[#0f1f4d]">{item.companyName}</p>
                    <span
                      className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${getSubscriptionStatusBadgeClass(item.status)}`}
                    >
                      {getSubscriptionStatusUiLabel(item.status)}
                    </span>
                  </div>
                  <AdminSubscriptionRowActions item={item} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <dt className="text-slate-400">Plan</dt>
                    <dd className="font-semibold text-slate-700">{item.planName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Dönem</dt>
                    <dd className="font-semibold text-slate-700">
                      {formatBillingInterval(item.billingInterval)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Bitiş</dt>
                    <dd>{formatAdminDate(item.currentPeriodEnd)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Sonraki ödeme</dt>
                    <dd>{formatAdminDate(item.nextBillingAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Auto-renew</dt>
                    <dd>{item.autoRenew ? "Açık" : "Kapalı"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Yenileme fiyatı</dt>
                    <dd className="font-bold">{item.renewalPriceFormatted}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
                const params = new URLSearchParams();
                Object.entries(filters).forEach(([key, value]) => {
                  if (value !== undefined && value !== "") {
                    params.set(key, String(value));
                  }
                });
                params.set("page", String(page));
                return (
                  <Link
                    key={page}
                    href={`/admin/subscriptions?${params.toString()}`}
                    className={`rounded-xl px-3 py-1.5 text-[13px] font-bold ${
                      page === pagination.page
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {page}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </AdminPageContainer>
  );
}
