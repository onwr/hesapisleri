import Link from "next/link";
import { Search } from "lucide-react";
import { AdminCompanyActions } from "@/components/admin/admin-company-actions";
import { AdminNavTabs } from "@/components/admin/admin-nav-tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  formatAdminDate,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusClass,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type { getAdminCompanies } from "@/lib/admin-service";

type CompaniesData = Awaited<ReturnType<typeof getAdminCompanies>>;

type AdminCompaniesContentProps = {
  companies: CompaniesData;
  filters: {
    q?: string;
    status?: string;
    membershipStatus?: string;
  };
};

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function AdminCompaniesContent({
  companies,
  filters,
}: AdminCompaniesContentProps) {
  return (
    <div>
      <AdminPageHeader
        title="Firmalar"
        description="Platformdaki tüm firmaları, üyelik durumlarını ve kullanım metriklerini yönetin."
      />
      <AdminNavTabs />

      <div className={cardClassName}>
        <form
          action="/admin/companies"
          method="get"
          className="mb-5 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]"
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
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-[13px] font-medium text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:bg-white"
            />
          </label>
          <select
            name="status"
            defaultValue={filters.status ?? "ALL"}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[13px] font-semibold text-[#0f1f4d]"
          >
            <option value="ALL">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
          <select
            name="membershipStatus"
            defaultValue={filters.membershipStatus ?? "ALL"}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[13px] font-semibold text-[#0f1f4d]"
          >
            <option value="ALL">Tüm üyelikler</option>
            <option value="ACTIVE">Aktif üyelik</option>
            <option value="PAST_DUE">Gecikmiş</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-[#0f1f4d] px-5 py-3 text-[13px] font-bold text-white"
          >
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Sahip</th>
                <th className="px-3 py-2">İletişim</th>
                <th className="px-3 py-2">Üyelik</th>
                <th className="px-3 py-2">Ödeme</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Satış</th>
                <th className="px-3 py-2">Oluşturulma</th>
                <th className="px-3 py-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Filtreye uygun firma bulunamadı.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-slate-50 align-top last:border-0"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/companies/${company.id}`}
                        className="font-extrabold text-[#0f1f4d] hover:underline"
                      >
                        {company.name}
                      </Link>
                      <div className="mt-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getCompanyStatusClass(company.status)}`}
                        >
                          {getCompanyStatusLabel(company.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#0f1f4d]">
                        {company.ownerName}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {company.ownerEmail ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>{company.phone ?? "—"}</p>
                      <p>{company.email ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getMembershipStatusClass(company.membershipStatus)}`}
                      >
                        {getMembershipStatusLabel(company.membershipStatus)}
                      </span>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {formatAdminMoney(company.monthlyFee)}/ay
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>Son: {formatAdminDate(company.lastPaymentDate)}</p>
                      <p>Sonraki: {formatAdminDate(company.nextPaymentDate)}</p>
                    </td>
                    <td className="px-3 py-3 font-bold text-[#0f1f4d]">
                      {company.userCount}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#0f1f4d]">
                      {company.salesCount}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(company.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="text-[12px] font-bold text-blue-600 hover:underline"
                        >
                          Detay
                        </Link>
                        <AdminCompanyActions
                          companyId={company.id}
                          companyName={company.name}
                          status={company.status}
                          membershipStatus={company.membershipStatus}
                          nextPaymentDate={company.nextPaymentDate}
                          monthlyFee={company.monthlyFee}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
