import Link from "next/link";
import {
  Search,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
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
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getPlatformRoleLabel,
} from "@/lib/admin-utils";
import type { getAdminUsers, getAdminUsersSummary } from "@/lib/admin-service";

type UsersData = Awaited<ReturnType<typeof getAdminUsers>>;
type SummaryData = Awaited<ReturnType<typeof getAdminUsersSummary>>;

type AdminUsersContentProps = {
  users: UsersData;
  summary: SummaryData;
  filters: {
    q?: string;
    status?: string;
    role?: string;
  };
  currentUserId: string;
};

export function AdminUsersContent({
  users,
  summary,
  filters,
  currentUserId,
}: AdminUsersContentProps) {
  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Kullanıcılar"
        description="Platform kullanıcılarını, Super Admin yetkilerini ve hesap durumlarını yönetin."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard
          title="Toplam"
          value={String(summary.total)}
          icon={Users}
          tone="blue"
        />
        <AdminStatCard
          title="Aktif"
          value={String(summary.active)}
          icon={UserCheck}
          tone="green"
          href="/admin/users?status=ACTIVE"
        />
        <AdminStatCard
          title="Pasif"
          value={String(summary.passive)}
          icon={UserMinus}
          tone="neutral"
          href="/admin/users?status=PASSIVE"
        />
        <AdminStatCard
          title="Super Admin"
          value={String(summary.superAdmins)}
          icon={Shield}
          tone="purple"
          href="/admin/users?role=SUPER_ADMIN"
        />
        <AdminStatCard
          title="Son 7 Gün Giriş"
          value={String(summary.recentLogins)}
          icon={UserCheck}
          tone="green"
        />
        <AdminStatCard
          title="Firmasız"
          value={String(summary.withoutCompany)}
          icon={UserPlus}
          tone="amber"
        />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <form
          action="/admin/users"
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
              placeholder="Ad veya e-posta ara..."
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
            name="role"
            defaultValue={filters.role ?? "ALL"}
            className={appSelectClass}
          >
            <option value="ALL">Tüm roller</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="USER">Kullanıcı</option>
          </select>
          <button type="submit" className={appPrimaryButtonClass}>
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
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
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Filtreye uygun kullanıcı bulunamadı.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`${appTableRowClass} align-top`}
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
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
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
                        : user.companies.map((c) => c.name).join(", ")}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(user.lastLoginAt)}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getCompanyStatusClass(user.status)}`}
                      >
                        {getCompanyStatusLabel(user.status)}
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
    </AdminPageContainer>
  );
}
