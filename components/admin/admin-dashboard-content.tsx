import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { AdminNavTabs } from "@/components/admin/admin-nav-tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  formatAdminDateTime,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusClass,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type { getAdminOverview } from "@/lib/admin-service";

type OverviewData = Awaited<ReturnType<typeof getAdminOverview>>;

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function AdminDashboardContent({ data }: { data: OverviewData }) {
  const { metrics, recentCompanies, recentLogs, overdueCompanies } = data;

  return (
    <div>
      <AdminPageHeader
        title="Super Admin Merkezi"
        description="Platform genelinde firmalar, kullanıcılar ve üyelik durumlarını yönetin."
      />
      <AdminNavTabs />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Toplam Firma"
          value={String(metrics.totalCompanies)}
          subtitle={`${metrics.activeCompanies} aktif`}
          icon={<Building2 size={18} />}
          color="blue"
        />
        <StatCard
          title="Toplam Kullanıcı"
          value={String(metrics.totalUsers)}
          icon={<Users size={18} />}
          color="purple"
        />
        <StatCard
          title="Bugün Oluşturulan Satış"
          value={String(metrics.todaySales)}
          icon={<ShoppingCart size={18} />}
          color="green"
        />
        <StatCard
          title="Bu Ay Platform Cirosu"
          value={formatAdminMoney(metrics.monthPlatformVolume)}
          icon={<TrendingUp size={18} />}
          color="orange"
        />
        <StatCard
          title="Aktif Üyelik"
          value={String(metrics.activeMemberships)}
          icon={<CreditCard size={18} />}
          color="green"
        />
        <StatCard
          title="Geciken Üyelik"
          value={String(metrics.pastDueMemberships)}
          highlight={
            metrics.pastDueMemberships > 0
              ? "Ödeme bekleyen firmalar var"
              : undefined
          }
          icon={<AlertCircle size={18} />}
          color="red"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className={cardClassName}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-extrabold text-[#0f1f4d]">
              Son Firmalar
            </h2>
            <Link
              href="/admin/companies"
              className="text-[13px] font-bold text-blue-600 hover:underline"
            >
              Tümünü gör
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Sahip</th>
                  <th className="px-3 py-2">Üyelik</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {recentCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-3 py-3 font-semibold text-[#0f1f4d]">
                      {company.name}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {company.ownerName}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getMembershipStatusClass(company.membershipStatus)}`}
                      >
                        {getMembershipStatusLabel(company.membershipStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getCompanyStatusClass(company.status)}`}
                      >
                        {getCompanyStatusLabel(company.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="font-bold text-blue-600 hover:underline"
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

        <div className="space-y-6">
          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Sistem Özeti
            </h2>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-500">Aktif firma</span>
                <span className="font-extrabold text-[#0f1f4d]">
                  {metrics.activeCompanies}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-500">
                  Aylık işlem hacmi
                </span>
                <span className="font-extrabold text-[#0f1f4d]">
                  {formatAdminMoney(metrics.monthPlatformVolume)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
                <span className="font-medium text-rose-600">
                  Geciken üyelik
                </span>
                <span className="font-extrabold text-rose-700">
                  {metrics.pastDueMemberships}
                </span>
              </div>
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Ödeme Bekleyen
            </h2>
            {overdueCompanies.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] font-medium text-slate-500">
                Geciken üyelik bulunmuyor.
              </p>
            ) : (
              <div className="space-y-2">
                {overdueCompanies.map((company) => (
                  <Link
                    key={company.id}
                    href={`/admin/companies/${company.id}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 transition hover:bg-white"
                  >
                    <span className="text-[13px] font-semibold text-[#0f1f4d]">
                      {company.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${getMembershipStatusClass(company.membershipStatus)}`}
                    >
                      {getMembershipStatusLabel(company.membershipStatus)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-6 ${cardClassName}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-[#0f1f4d]">
            Son Sistem Kayıtları
          </h2>
          <Link
            href="/admin/logs"
            className="text-[13px] font-bold text-blue-600 hover:underline"
          >
            Tüm kayıtlar
          </Link>
        </div>
        <div className="space-y-2">
          {recentLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-[13px] font-semibold text-[#0f1f4d]">
                  {log.message || `${log.module} / ${log.action}`}
                </p>
                <p className="text-[12px] text-slate-500">
                  {log.userName}
                  {log.companyName ? ` · ${log.companyName}` : ""}
                </p>
              </div>
              <span className="text-[12px] font-medium text-slate-400">
                {formatAdminDateTime(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
