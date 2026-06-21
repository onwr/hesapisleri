import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CreditCard,
  RefreshCcw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { AdminMiniBarChart } from "@/components/admin/layout/admin-mini-bar-chart";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSectionHeader } from "@/components/admin/layout/admin-section-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
  appTextPrimaryClass,
} from "@/lib/admin-ui";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusClass,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type { getAdminOverview } from "@/lib/admin-service";

type OverviewData = Awaited<ReturnType<typeof getAdminOverview>>;

function attentionPriorityClass(priority: string) {
  if (priority === "high") return "bg-rose-50 text-rose-600";
  if (priority === "medium") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-600";
}

export function AdminDashboardContent({ data }: { data: OverviewData }) {
  const {
    metrics,
    recentCompanies,
    recentLogs,
    attentionItems,
    recentPayments,
    revenueChart,
    companiesChart,
  } = data;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Platform Genel Bakış"
        description="Firma, kullanıcı, gelir ve sistem operasyonlarını tek merkezden yönetin."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatCard
          title="Toplam Firma"
          value={String(metrics.totalCompanies)}
          description={`${metrics.activeCompanies} aktif firma`}
          icon={Building2}
          tone="blue"
          href="/admin/companies"
        />
        <AdminStatCard
          title="Aktif Abonelik"
          value={String(metrics.activeMemberships)}
          icon={RefreshCcw}
          tone="green"
          href="/admin/companies?membershipStatus=ACTIVE"
        />
        <AdminStatCard
          title="Aylık Üyelik Geliri"
          value={formatAdminMoney(metrics.monthMembershipRevenue)}
          changePercent={metrics.membershipRevenueChange}
          comparisonLabel="önceki aya göre"
          icon={CreditCard}
          tone="purple"
          href="/admin/payments"
        />
        <AdminStatCard
          title="Bekleyen Ödeme"
          value={String(metrics.pendingPayments)}
          highlight={
            metrics.pendingPayments > 0 ? "Onay bekleyen kayıt var" : undefined
          }
          icon={AlertCircle}
          tone="amber"
          href="/admin/payments"
        />
        <AdminStatCard
          title="Deneme Firma"
          value={String(metrics.trialSubscriptions)}
          icon={Users}
          tone="blue"
          href="/admin/companies"
        />
        <AdminStatCard
          title="Geciken Üyelik"
          value={String(metrics.pastDueMemberships)}
          description="Ödeme gecikmesi olan abonelikler"
          icon={AlertCircle}
          tone="red"
          href="/admin/companies?membershipStatus=PAST_DUE"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <AdminMiniBarChart
            title="Son 7 Gün Üyelik Geliri"
            data={revenueChart.map((d) => ({ label: d.label, value: d.value }))}
            valueFormat="money"
            emptyMessage="Bu dönemde üyelik geliri oluşmadı."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className={`${appPanelClass} p-4`}>
              <AdminSectionHeader
                title="Son Firmalar"
                action={
                  <Link
                    href="/admin/companies"
                    className="text-[12px] font-bold text-blue-600 hover:underline"
                  >
                    Tümünü gör
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className={appTableClass}>
                  <thead>
                    <tr className={appTableHeadClass}>
                      <th className="px-3 py-2">Firma</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Üyelik</th>
                      <th className="px-3 py-2">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCompanies.map((company) => (
                      <tr key={company.id} className={appTableRowClass}>
                        <td className="px-3 py-3">
                          <p className={`font-bold ${appTextPrimaryClass}`}>
                            {company.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {company.ownerName}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {company.planName ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getMembershipStatusClass(company.membershipStatus)}`}
                          >
                            {getMembershipStatusLabel(company.membershipStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/companies/${company.id}`}
                            className="text-[12px] font-bold text-blue-600 hover:underline"
                          >
                            Detay
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${appPanelClass} p-4`}>
              <AdminSectionHeader
                title="Son Ödemeler"
                action={
                  <Link
                    href="/admin/payments"
                    className="text-[12px] font-bold text-blue-600 hover:underline"
                  >
                    Tümü
                  </Link>
                }
              />
              <div className="space-y-2">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-[13px] font-bold ${appTextPrimaryClass}`}>
                        {payment.companyName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {payment.planName} · {payment.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-extrabold text-[#0f1f4d]">
                        {formatAdminMoney(payment.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <AdminMiniBarChart
            title="Son 7 Gün Yeni Firma"
            data={companiesChart.map((d) => ({ label: d.label, value: d.value }))}
            emptyMessage="Bu dönemde yeni firma kaydı yok."
          />
        </div>

        <div className="space-y-4">
          <div className={`${appPanelClass} p-4`}>
            <AdminSectionHeader
              title="Dikkat Gerektirenler"
              action={
                attentionItems.length > 0 ? (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">
                    {attentionItems.length}
                  </span>
                ) : null
              }
            />
            {attentionItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-[13px] font-medium text-slate-500">
                Acil işlem bulunmuyor.
              </p>
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 transition hover:border-blue-100 hover:bg-blue-50/40"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${attentionPriorityClass(item.priority)}`}
                    >
                      <AlertCircle size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#0f1f4d]">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="mt-1 shrink-0 text-slate-300 transition group-hover:text-blue-500"
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={`${appPanelClass} p-4`}>
            <AdminSectionHeader title="Platform Metrikleri" />
            <div className="divide-y divide-slate-100">
              <MetricRow
                icon={<ShoppingCart size={15} />}
                label="İşletme satış hacmi (bu ay)"
                value={formatAdminMoney(metrics.monthBusinessVolume)}
              />
              <MetricRow
                icon={<Users size={15} />}
                label="Toplam kullanıcı"
                value={String(metrics.totalUsers)}
              />
              <MetricRow
                icon={<Building2 size={15} />}
                label="Bugün oluşturulan satış"
                value={String(metrics.todaySales)}
              />
            </div>
          </div>

          <div className={`${appPanelClass} p-4`}>
            <AdminSectionHeader title="Hızlı İşlemler" />
            <div className="grid gap-2">
              <Link href="/admin/payments" className={appOutlineButtonClass}>
                Ödemeleri İncele
              </Link>
              <Link href="/admin/membership-plans" className={appOutlineButtonClass}>
                Plan Fiyatlarını Yönet
              </Link>
              <Link
                href="/admin/partners/applications"
                className={appOutlineButtonClass}
              >
                Partner Başvuruları
              </Link>
            </div>
          </div>

          <div className={`${appPanelClass} p-4`}>
            <AdminSectionHeader
              title="Son Kayıtlar"
              action={
                <Link
                  href="/admin/logs"
                  className="text-[12px] font-bold text-blue-600 hover:underline"
                >
                  Tümü
                </Link>
              }
            />
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                >
                  <p className="text-[12px] font-semibold text-[#0f1f4d]">
                    {log.message || `${log.module} / ${log.action}`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {log.userName}
                    {log.companyName ? ` · ${log.companyName}` : ""}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatAdminDateTime(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <span className="text-[13px] font-extrabold text-[#0f1f4d]">{value}</span>
    </div>
  );
}
