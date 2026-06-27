"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appPanelClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import {
  formatAdminDate,
  formatAdminDateTime,
} from "@/lib/admin-utils";
import {
  getUserStatusClass,
  getUserStatusLabel,
  getLoginTrackingLabel,
} from "@/lib/admin/users/admin-user-serializers";
import { getIssueLabel } from "@/lib/admin/users/admin-user-issue-service";
import type {
  getAdminUserList,
  getAdminUsersSummaryExtended,
} from "@/lib/admin/users/admin-user-list-service";

type UserList = Awaited<ReturnType<typeof getAdminUserList>>;
type Summary = Awaited<ReturnType<typeof getAdminUsersSummaryExtended>>;

type Props = {
  list: UserList;
  summary: Summary;
  filters: {
    q?: string;
    status?: string;
    platformRole?: string;
    loginStatus?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
  };
};

export function AdminUsersListContent({ list, summary, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function pushPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleExport() {
    const params = new URLSearchParams(searchParams.toString());
    const res = await fetch(`/api/admin/users/export?${params.toString()}`);
    if (!res.ok) {
      alert("CSV dışa aktarım başarısız.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Kullanıcılar"
        description="Platform kullanıcılarını görüntüle, filtrele ve yönet."
      />

      {/* Özet kartları */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Toplam" value={summary.total} />
        <StatCard label="Aktif" value={summary.active} color="green" />
        <StatCard label="Askıda" value={summary.suspended} color="red" />
        <StatCard label="Davet Bekleyen" value={summary.pendingInvite} />
        <StatCard label="Hiç Giriş Yapmamış" value={summary.neverLoggedIn} />
        <StatCard label="30+ Gün İnaktif" value={summary.inactive30d} />
        <StatCard label="Son 30 Gün Yeni" value={summary.newThisMonth} color="blue" />
        <StatCard label="Son 30 Gün Giriş" value={summary.loggedIn30d} color="green" />
        <StatCard label="Giriş Geç. İzlenmiyor" value={summary.unknownLegacy} />
        <StatCard label="Doğrulama Bekleyen" value={summary.pendingVerification} />
        <StatCard label="Çoklu Firma" value={summary.multiCompany} />
        <StatCard label="Platform Yöneticileri" value={summary.platformAdmins} color="blue" />
      </div>

      {/* Filtreler */}
      <div className={`${appPanelClass} mb-4`}>
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Ad veya e-posta ara…"
            defaultValue={filters.q ?? ""}
            className={appInputClass}
            style={{ minWidth: 200 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushFilter("q", (e.target as HTMLInputElement).value);
              }
            }}
          />
          <select
            className={appSelectClass}
            defaultValue={filters.status ?? "ALL"}
            onChange={(e) => pushFilter("status", e.target.value)}
          >
            <option value="ALL">Tüm Durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
          <select
            className={appSelectClass}
            defaultValue={filters.platformRole ?? "ALL"}
            onChange={(e) => pushFilter("platformRole", e.target.value)}
          >
            <option value="ALL">Tüm Roller</option>
            <option value="SUPER_ADMIN">Platform Yöneticisi</option>
            <option value="USER">Kullanıcı</option>
          </select>
          <select
            className={appSelectClass}
            defaultValue={filters.loginStatus ?? "ALL"}
            onChange={(e) => pushFilter("loginStatus", e.target.value)}
          >
            <option value="ALL">Tüm Giriş Durumu</option>
            <option value="ACTIVE_30D">Son 30 Gün Aktif</option>
            <option value="INACTIVE_30D">30+ Gün İnaktif</option>
            <option value="NEVER">Hiç Giriş Yapmamış</option>
            <option value="UNKNOWN">Giriş Takibi Yok</option>
          </select>
          <button
            onClick={handleExport}
            className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            CSV İndir
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className={appPanelClass}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] text-slate-500">
            {list.total} kullanıcı · Sayfa {list.page}/{list.totalPages}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr>
                <th className={appTableHeadClass}>Ad / E-posta</th>
                <th className={appTableHeadClass}>Durum</th>
                <th className={appTableHeadClass}>Rol</th>
                <th className={appTableHeadClass}>Son Giriş</th>
                <th className={appTableHeadClass}>Firma</th>
                <th className={appTableHeadClass}>Sorunlar</th>
                <th className={appTableHeadClass}>Kayıt</th>
                <th className={appTableHeadClass}></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((user) => (
                <tr key={user.id} className={appTableRowClass}>
                  <td className="px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-[#0f1f4d]">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{user.email}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getUserStatusClass(user.status)}`}
                    >
                      {getUserStatusLabel(user.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">
                    {user.platformRole === "SUPER_ADMIN"
                      ? "Platform Yön."
                      : "Kullanıcı"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500">
                    {user.lastLoginAt
                      ? formatAdminDateTime(user.lastLoginAt)
                      : getLoginTrackingLabel(user.loginTrackingStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">
                    {user.companyCount}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {user.issues.map((issue) => (
                        <span
                          key={issue}
                          className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700"
                        >
                          {getIssueLabel(issue)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-400">
                    {formatAdminDate(user.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {list.totalPages > 1 && (
          <div className="mt-4 flex gap-2">
            {list.page > 1 && (
              <button
                onClick={() => pushPage(list.page - 1)}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200"
              >
                ← Önceki
              </button>
            )}
            {list.page < list.totalPages && (
              <button
                onClick={() => pushPage(list.page + 1)}
                className="rounded-full bg-slate-100 px-4 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200"
              >
                Sonraki →
              </button>
            )}
          </div>
        )}
      </div>
    </AdminPageContainer>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red" | "blue";
}) {
  const colorClass =
    color === "green"
      ? "text-emerald-700"
      : color === "red"
        ? "text-rose-700"
        : color === "blue"
          ? "text-blue-700"
          : "text-[#0f1f4d]";

  return (
    <div className="rounded-[18px] border border-slate-200/70 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`text-[22px] font-extrabold ${colorClass}`}>{value}</p>
    </div>
  );
}
