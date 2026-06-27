import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  Handshake,
  RefreshCcw,
  Server,
  Users,
} from "lucide-react";
import { AdminOverviewCharts } from "@/components/admin/overview/admin-overview-charts";
import { AdminOverviewDateFilter } from "@/components/admin/overview/admin-overview-date-filter";
import { AdminOverviewGlobalSearch } from "@/components/admin/overview/admin-overview-global-search";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
  appTextPrimaryClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime, formatAdminMoney } from "@/lib/admin-utils";
import type { AdminOverviewData } from "@/lib/admin/admin-overview-service";
import type { AdminOverviewMetricGroup } from "@/lib/admin/admin-overview-metric-utils";
import { getMembershipStatusLabel } from "@/lib/admin-utils";

const GROUP_META: Record<
  AdminOverviewMetricGroup,
  { title: string; icon: typeof Building2 }
> = {
  companies: { title: "Firmalar", icon: Building2 },
  users: { title: "Kullanıcılar", icon: Users },
  revenue: { title: "Gelir", icon: CreditCard },
  subscriptions: { title: "Abonelik", icon: RefreshCcw },
};

const QUICK_ACTIONS = [
  { label: "Firma ara", href: "/admin/companies" },
  { label: "Kullanıcı ara", href: "/admin/users" },
          { label: "Yeni plan", href: "/admin/plans" },
  { label: "Kampanya oluştur", href: "/admin/campaigns/new" },
  { label: "Kupon oluştur", href: "/admin/membership-coupons/new" },
  { label: "Partner başvuruları", href: "/admin/partners/applications" },
  { label: "Başarısız ödemeler", href: "/admin/payments?status=FAILED" },
];

function systemStatusClass(status: string) {
  if (status === "ok") return "text-emerald-600";
  if (status === "warning") return "text-amber-600";
  if (status === "error") return "text-rose-600";
  return "text-slate-500";
}

export function AdminOverviewContent({ data }: { data: AdminOverviewData }) {
  const metricGroups = (
    Object.keys(GROUP_META) as AdminOverviewMetricGroup[]
  ).map((group) => ({
    group,
    ...GROUP_META[group],
    items: data.metrics.filter((metric) => metric.group === group),
  }));

  const paymentRows = [
    ...data.paymentIssues.failed,
    ...data.paymentIssues.pending.slice(0, 5),
    ...data.paymentIssues.callbackIssues.slice(0, 5),
  ].slice(0, 12);

  return (
    <AdminPageContainer size="full">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
            Platform Genel Bakış
          </h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            {data.period.label} · {formatAdminDateTime(data.period.from)} —{" "}
            {formatAdminDateTime(data.period.to)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={appOutlineButtonClass}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <AdminOverviewGlobalSearch />
        <AdminOverviewDateFilter
          period={data.period.key}
          from={data.period.from}
          to={data.period.to}
        />
      </div>

      <div className="mt-5 space-y-5">
        {metricGroups.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.group}>
              <div className="mb-3 flex items-center gap-2">
                <Icon size={16} className="text-[#1e3a8a]" />
                <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-[#24345f]/80">
                  {section.title}
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {section.items.map((metric) => (
                  <AdminStatCard
                    key={metric.key}
                    title={metric.label}
                    value={metric.formattedValue}
                    description={metric.description}
                    href={metric.href}
                    changePercent={metric.changePercent}
                    comparisonLabel={metric.comparisonLabel}
                    tone={
                      section.group === "revenue"
                        ? "purple"
                        : section.group === "subscriptions"
                          ? "green"
                          : "blue"
                    }
                    icon={Icon}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <AdminOverviewCharts
          revenueSeries={data.revenueSeries}
          companyGrowthSeries={data.companyGrowthSeries}
          subscriptionDistribution={data.subscriptionDistribution}
          userActivitySeries={data.userActivitySeries}
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <div className={`${appPanelClass} p-4 xl:col-span-2`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h3 className="text-[13px] font-extrabold text-[#0f1f4d]">
                  Dikkat Gerektiren Firmalar
                </h3>
              </div>
              <Link
                href="/admin/subscriptions?status=PAST_DUE"
                className="text-[12px] font-bold text-blue-600 hover:underline"
              >
                Tümünü gör
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className={appTableClass}>
                <thead>
                  <tr className={appTableHeadClass}>
                    <th className="px-3 py-2">Firma</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Sorun</th>
                    <th className="px-3 py-2">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companiesRequiringAttention.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-[12px] text-slate-500"
                      >
                        Dikkat gerektiren firma yok.
                      </td>
                    </tr>
                  ) : (
                    data.companiesRequiringAttention.map((row) => (
                      <tr key={row.id} className={appTableRowClass}>
                        <td className="px-3 py-3">
                          <p className={`font-bold ${appTextPrimaryClass}`}>
                            {row.companyName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {row.ownerName}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[12px] text-slate-600">
                          {row.planName ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-[12px]">
                          {getMembershipStatusLabel(row.subscriptionStatus)}
                        </td>
                        <td className="px-3 py-3 text-[12px] font-medium text-amber-700">
                          {row.issue}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                            <Link
                              href={row.actions.companyHref}
                              className="text-blue-600 hover:underline"
                            >
                              Firma
                            </Link>
                            {row.actions.subscriptionHref ? (
                              <Link
                                href={row.actions.subscriptionHref}
                                className="text-blue-600 hover:underline"
                              >
                                Abonelik
                              </Link>
                            ) : null}
                            <Link
                              href={row.actions.paymentsHref}
                              className="text-blue-600 hover:underline"
                            >
                              Ödemeler
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${appPanelClass} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Handshake size={16} className="text-violet-600" />
              <h3 className="text-[13px] font-extrabold text-[#0f1f4d]">
                Ortaklık Özeti
              </h3>
            </div>
            <dl className="space-y-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bekleyen başvuru</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {data.partnerSummary.pendingApplications}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Aktif partner</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {data.partnerSummary.activePartners}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Dönem referansı</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {data.partnerSummary.referralsInPeriod}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Ücretli dönüşüm</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {data.partnerSummary.paidConversionsInPeriod}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Bekleyen kazanç</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {formatAdminMoney(data.partnerSummary.pendingEarnings)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Ödenmesi gereken</dt>
                <dd className="font-bold text-[#0f1f4d]">
                  {formatAdminMoney(data.partnerSummary.payableEarnings)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={data.partnerSummary.links.partners}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Partnerler
              </Link>
              <Link
                href={data.partnerSummary.links.applications}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Başvurular
              </Link>
              <Link
                href={data.partnerSummary.links.payouts}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Ödemeler
              </Link>
            </div>
          </div>
        </div>

        <div className={`${appPanelClass} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-extrabold text-[#0f1f4d]">
              Ödeme Sorunları
            </h3>
            <Link
              href="/admin/payments?status=FAILED"
              className="text-[12px] font-bold text-blue-600 hover:underline"
            >
              Tüm başarısız ödemeler
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Tutar</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Hata</th>
                  <th className="px-3 py-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-[12px] text-slate-500"
                    >
                      Ödeme sorunu kaydı yok.
                    </td>
                  </tr>
                ) : (
                  paymentRows.map((row) => (
                    <tr key={row.id} className={appTableRowClass}>
                      <td className="px-3 py-3">
                        <Link
                          href={row.companyHref}
                          className="font-bold text-[#0f1f4d] hover:underline"
                        >
                          {row.companyName}
                        </Link>
                        <p className="text-[11px] text-slate-500">{row.issue}</p>
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {"amount" in row ? formatAdminMoney(row.amount) : "—"}
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {"status" in row ? row.status : "—"}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-rose-600">
                        {row.errorSummary}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-slate-500">
                        {row.date ? formatAdminDateTime(row.date) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className={`${appPanelClass} p-4 lg:col-span-2`}>
            <h3 className="mb-3 text-[13px] font-extrabold text-[#0f1f4d]">
              Son Platform Hareketleri
            </h3>
            <div className="space-y-2">
              {data.recentPlatformActivity.length === 0 ? (
                <p className="text-[12px] text-slate-500">Henüz hareket yok.</p>
              ) : (
                data.recentPlatformActivity.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-blue-50/50"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#0f1f4d]">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.type} · {item.actorName}
                        {item.companyName ? ` · ${item.companyName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatAdminDateTime(item.createdAt)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className={`${appPanelClass} p-4`}>
            <div className="mb-3 flex items-center gap-2">
              <Server size={16} className="text-slate-600" />
              <h3 className="text-[13px] font-extrabold text-[#0f1f4d]">
                Sistem Özeti
              </h3>
            </div>
            <dl className="space-y-3 text-[12px]">
              {Object.entries(data.systemSummary).map(([key, item]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="capitalize text-slate-500">
                    {key === "database"
                      ? "Veritabanı"
                      : key === "application"
                        ? "Uygulama"
                        : key === "lastCronRun"
                          ? "Son cron"
                          : key === "failedJobs"
                            ? "Başarısız iş"
                            : key === "pendingJobs"
                              ? "Bekleyen iş"
                              : "Son kritik hata"}
                  </dt>
                  <dd>
                    {"href" in item && item.href ? (
                      <Link
                        href={item.href}
                        className={`font-bold hover:underline ${systemStatusClass(item.status)}`}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className={`font-bold ${systemStatusClass(item.status)}`}>
                        {item.label}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href="/admin/system-logs"
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-blue-600 hover:underline"
            >
              Sistem logları
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}
