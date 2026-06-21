import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  CircleAlert,
  CircleCheck,
  PauseCircle,
  Search,
  TimerReset,
} from "lucide-react";
import { AdminCompaniesRowActions } from "@/components/admin/admin-companies-row-actions";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appInputClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import {
  formatAdminDate,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusClass,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type {
  getAdminCompanies,
  getAdminCompaniesSummary,
} from "@/lib/admin-service";

type CompaniesData = Awaited<ReturnType<typeof getAdminCompanies>>;
type SummaryData = Awaited<ReturnType<typeof getAdminCompaniesSummary>>;

type AdminCompaniesContentProps = {
  companies: CompaniesData;
  summary: SummaryData;
  filters: {
    q?: string;
    status?: string;
    membershipStatus?: string;
  };
};

export function AdminCompaniesContent({
  companies,
  summary,
  filters,
}: AdminCompaniesContentProps) {
  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Firmalar"
        description="Platforma kayıtlı tüm işletmeleri ve üyelik durumlarını yönetin."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          title="Toplam"
          value={String(summary.total)}
          icon={Building2}
          tone="blue"
        />
        <AdminStatCard
          title="Aktif"
          value={String(summary.active)}
          icon={CircleCheck}
          tone="green"
          href="/admin/companies?status=ACTIVE"
          ariaLabel="Aktif firmaları filtrele"
        />
        <AdminStatCard
          title="Deneme"
          value={String(summary.trial)}
          icon={TimerReset}
          tone="purple"
        />
        <AdminStatCard
          title="Gecikmiş"
          value={String(summary.pastDue)}
          icon={CircleAlert}
          tone="amber"
          href="/admin/companies?membershipStatus=PAST_DUE"
          ariaLabel="Gecikmiş üyelikleri filtrele"
        />
        <AdminStatCard
          title="Askıda"
          value={String(summary.suspended)}
          icon={PauseCircle}
          tone="red"
          href="/admin/companies?status=SUSPENDED"
          ariaLabel="Askıdaki firmaları filtrele"
        />
        <AdminStatCard
          title="Bu Ay Yeni"
          value={String(summary.newThisMonth)}
          icon={CalendarPlus}
          tone="blue"
        />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <form
          action="/admin/companies"
          method="get"
          className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]"
        >
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Firma adı, e-posta veya telefon ara..."
              className={`${appInputClass} pl-10`}
            />
          </label>
          <select
            name="status"
            defaultValue={filters.status ?? "ALL"}
            className={appSelectClass}
          >
            <option value="ALL">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
          <select
            name="membershipStatus"
            defaultValue={filters.membershipStatus ?? "ALL"}
            className={appSelectClass}
          >
            <option value="ALL">Tüm üyelikler</option>
            <option value="ACTIVE">Aktif üyelik</option>
            <option value="PAST_DUE">Gecikmiş</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <button type="submit" className={appPrimaryButtonClass}>
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Sahip</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Üyelik Durumu</th>
                <th className="px-3 py-2">Sonraki Ödeme</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Oluşturulma</th>
                <th className="px-3 py-2">Firma Durumu</th>
                <th className="px-3 py-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    Filtreye uygun firma bulunamadı.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr
                    key={company.id}
                    className={`${appTableRowClass} align-top`}
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="font-extrabold text-[#0f1f4d] hover:underline"
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>{company.ownerName}</p>
                      <p className="text-[11px] text-slate-400">
                        {company.ownerEmail}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {company.planName ?? "—"}
                      {company.billingInterval ? (
                        <p className="text-[11px] text-slate-400">
                          {company.billingInterval}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getMembershipStatusClass(company.membershipStatus)}`}
                      >
                        {getMembershipStatusLabel(company.membershipStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(company.nextPaymentDate)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{company.userCount}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(company.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getCompanyStatusClass(company.status)}`}
                      >
                        {getCompanyStatusLabel(company.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <AdminCompaniesRowActions
                        companyId={company.id}
                        companyName={company.name}
                        status={company.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageContainer>
  );
}
