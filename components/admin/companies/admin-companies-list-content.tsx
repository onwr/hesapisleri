import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { AdminCompaniesSearchInput } from "@/components/admin/companies/admin-companies-search-input";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
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
import type { AdminCompanyListMetrics } from "@/lib/admin/companies/admin-company-metric-service";
import type { listAdminCompaniesPaginated } from "@/lib/admin/companies/admin-company-list-service";
import type { AdminCompanyListFilters } from "@/lib/admin/companies/admin-company-filter-utils";
import type { listAdminCompanyPlans } from "@/lib/admin/companies/admin-company-list-service";

type ListData = Awaited<ReturnType<typeof listAdminCompaniesPaginated>>;
type Plans = Awaited<ReturnType<typeof listAdminCompanyPlans>>;

type Props = {
  list: ListData;
  metrics: AdminCompanyListMetrics;
  filters: AdminCompanyListFilters;
  plans: Plans;
};

function issueClass(severity: string) {
  if (severity === "danger") return "bg-rose-100 text-rose-700";
  if (severity === "warning") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function buildPageHref(filters: AdminCompanyListFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "" && key !== "page" && key !== "pageSize") {
      params.set(key, String(value));
    }
  }
  params.set("page", String(page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  return `/admin/companies?${params.toString()}`;
}

export function AdminCompaniesListContent({
  list,
  metrics,
  filters,
  plans,
}: Props) {
  const exportHref = `/api/admin/companies?${new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => [k, String(v)])
    ),
    export: "csv",
  }).toString()}`;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Firmalar"
        description="Platform firmalarını filtreleyin, sorunları izleyin ve detay yönetimine geçin."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <AdminStatCard title="Toplam" value={String(metrics.total)} href="/admin/companies" icon={Building2} />
        <AdminStatCard title="Aktif" value={String(metrics.active)} href="/admin/companies?status=ACTIVE" icon={Building2} />
        <AdminStatCard title="Trial" value={String(metrics.trial)} href="/admin/companies?subscription=TRIAL" icon={Building2} />
        <AdminStatCard title="Ücretli" value={String(metrics.paid)} href="/admin/companies?subscription=ACTIVE" icon={Building2} />
        <AdminStatCard title="Past Due" value={String(metrics.pastDue)} href="/admin/companies?subscription=PAST_DUE" icon={Building2} />
        <AdminStatCard title="Askıda" value={String(metrics.suspended)} href="/admin/companies?status=SUSPENDED" icon={Building2} />
        <AdminStatCard title="Son 30 gün yeni" value={String(metrics.newLast30Days)} href="/admin/companies?created=30d" icon={Building2} />
        <AdminStatCard title="30+ gün inaktif" value={String(metrics.inactiveLast30Days)} href="/admin/companies?issue=inactive" icon={Building2} />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <form action="/admin/companies" method="get" className="mb-4 space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto]">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <AdminCompaniesSearchInput defaultValue={filters.q ?? ""} />
            </label>
            <select name="status" defaultValue={filters.status ?? "ALL"} className={appSelectClass}>
              <option value="ALL">Firma durumu</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
              <option value="SUSPENDED">Askıda</option>
              <option value="ARCHIVED">Arşiv</option>
            </select>
            <select name="subscription" defaultValue={filters.subscription ?? "ALL"} className={appSelectClass}>
              <option value="ALL">Abonelik</option>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PAST_DUE">Past Due</option>
              <option value="CANCELLED">İptal</option>
              <option value="NONE">Yok</option>
            </select>
            <select name="planId" defaultValue={filters.planId ?? "ALL"} className={appSelectClass}>
              <option value="ALL">Plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
            <select name="issue" defaultValue={filters.issue ?? "ALL"} className={appSelectClass}>
              <option value="ALL">Sorun</option>
              <option value="trial_ending">Trial bitiyor</option>
              <option value="payment_overdue">Ödeme gecikmiş</option>
              <option value="payment_failed">Son ödeme başarısız</option>
              <option value="multiple_failed_payments">Çoklu başarısız ödeme</option>
              <option value="inactive_login">Uzun süredir giriş yok</option>
              <option value="integration_error">Entegrasyon hatası</option>
            </select>
            <button type="submit" className={appPrimaryButtonClass}>Filtrele</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select name="sort" defaultValue={filters.sort ?? "newest"} className={appSelectClass}>
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
              <option value="name">Firma adı</option>
              <option value="last_activity">Son aktivite</option>
              <option value="subscription_end">Abonelik bitişi</option>
              <option value="user_count">Kullanıcı sayısı</option>
            </select>
            <select name="pageSize" defaultValue={String(filters.pageSize ?? 25)} className={appSelectClass}>
              <option value="25">25 kayıt</option>
              <option value="50">50 kayıt</option>
              <option value="100">100 kayıt</option>
            </select>
            <Link href="/admin/companies" className={appOutlineButtonClass}>Filtreleri temizle</Link>
            <a href={exportHref} className={appOutlineButtonClass}>CSV dışa aktar</a>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Sahip</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Abonelik</th>
                <th className="px-3 py-2">Ödeme</th>
                <th className="px-3 py-2">Kullanım</th>
                <th className="px-3 py-2">Aktivite</th>
                <th className="px-3 py-2">Sorun</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    Filtreye uygun firma bulunamadı.
                  </td>
                </tr>
              ) : (
                list.items.map((company) => (
                  <tr key={company.id} className={appTableRowClass}>
                    <td className="px-3 py-2">
                      <Link href={company.href} className="font-bold text-[#0f1f4d] hover:underline">
                        {company.name}
                      </Link>
                      <p className="text-[11px] text-slate-400">{company.shortId}</p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${getCompanyStatusClass(company.status)}`}>
                        {getCompanyStatusLabel(company.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {company.owner ? (
                        <>
                          <p className="font-semibold">{company.owner.name}</p>
                          <p className="text-slate-500">{company.owner.email}</p>
                        </>
                      ) : (
                        <span className="font-semibold text-rose-600">Sahip yok</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {company.plan ? (
                        <>
                          <p>{company.plan.name}</p>
                          <p className="text-slate-500">{company.plan.intervalLabel ?? "—"}</p>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {company.subscription ? (
                        <>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${getMembershipStatusClass(company.subscription.status)}`}>
                            {getMembershipStatusLabel(company.subscription.status)}
                          </span>
                          <p className="mt-1 text-slate-500">
                            {company.subscription.currentPeriodEnd
                              ? formatAdminDate(company.subscription.currentPeriodEnd)
                              : "—"}
                          </p>
                        </>
                      ) : "Abonelik yok"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {company.payment.status ? (
                        <>
                          <p>{company.payment.status}</p>
                          <p className="font-semibold">
                            {company.payment.amount != null
                              ? formatAdminMoney(company.payment.amount)
                              : "—"}
                          </p>
                        </>
                      ) : "Kayıt yok"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {company.usage.users} kullanıcı · {company.usage.products} ürün
                      <br />
                      {company.usage.warehouses} depo · {company.usage.employees} çalışan
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {company.activity.lastLoginAt
                        ? formatAdminDateTime(company.activity.lastLoginAt)
                        : "Giriş yok"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {company.issues.slice(0, 2).map((issue) => (
                          <span key={issue.code} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${issueClass(issue.severity)}`}>
                            {issue.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1 text-[11px] font-semibold">
                        <Link href={company.href} className="text-[#0f1f4d] hover:underline">Detay</Link>
                        <Link href={`${company.href}?tab=users`} className="text-slate-600 hover:underline">Kullanıcılar</Link>
                        <Link href={`${company.href}?tab=payments`} className="text-slate-600 hover:underline">Ödemeler</Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Toplam {list.total} firma · Sayfa {list.page}/{list.totalPages}
          </span>
          <div className="flex gap-2">
            {list.page > 1 ? (
              <Link href={buildPageHref(filters, list.page - 1)} className={appOutlineButtonClass}>
                Önceki
              </Link>
            ) : null}
            {list.page < list.totalPages ? (
              <Link href={buildPageHref(filters, list.page + 1)} className={appOutlineButtonClass}>
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}
