import Link from "next/link";
import { Search } from "lucide-react";
import { AdminNavTabs } from "@/components/admin/admin-nav-tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import {
  formatAdminDate,
  getCompanyStatusClass,
  getPlatformRoleLabel,
} from "@/lib/admin-utils";
import type { getAdminUsers } from "@/lib/admin-service";

type UsersData = Awaited<ReturnType<typeof getAdminUsers>>;

type AdminUsersContentProps = {
  users: UsersData;
  filters: {
    q?: string;
    status?: string;
    role?: string;
  };
  currentUserId: string;
};

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function AdminUsersContent({
  users,
  filters,
  currentUserId,
}: AdminUsersContentProps) {
  return (
    <div>
      <AdminPageHeader
        title="Kullanıcılar"
        description="Platform kullanıcılarını, Super Admin yetkilerini ve hesap durumlarını yönetin."
      />
      <AdminNavTabs />

      <div className={cardClassName}>
        <form
          action="/admin/users"
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
              placeholder="Ad veya e-posta ara..."
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
            name="role"
            defaultValue={filters.role ?? "ALL"}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[13px] font-semibold text-[#0f1f4d]"
          >
            <option value="ALL">Tüm roller</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="USER">Kullanıcı</option>
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
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Firmalar</th>
                <th className="px-3 py-2">Son Giriş</th>
                <th className="px-3 py-2">Oluşturulma</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Filtreye uygun kullanıcı bulunamadı.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-50 align-top last:border-0"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-extrabold text-[#0f1f4d] hover:underline"
                      >
                        {user.name}
                      </Link>
                      <p className="text-[12px] text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          user.role === "SUPER_ADMIN"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {getPlatformRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {user.companies.length === 0
                        ? "—"
                        : user.companies
                            .map((company) => company.name)
                            .join(", ")}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(user.lastLoginAt)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getCompanyStatusClass(user.status)}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-[12px] font-bold text-blue-600 hover:underline"
                        >
                          Detay
                        </Link>
                        <AdminUserActions
                          userId={user.id}
                          userName={user.name}
                          role={user.role}
                          status={user.status}
                          isSelf={user.id === currentUserId}
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
