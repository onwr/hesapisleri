import Link from "next/link";
import { Search } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { getAdminLogs } from "@/lib/admin-service";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    module?: string;
    action?: string;
    page?: string;
  }>;
};

function getModuleClass(module: string) {
  if (module === "admin") return "bg-slate-900 text-white";
  if (module === "auth") return "bg-blue-100 text-blue-700";
  if (module === "sales") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const logs = await getAdminLogs({
    q: params.q,
    module: params.module,
    action: params.action,
    page: Number.isFinite(page) ? page : 1,
    pageSize: 30,
  });

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.module) query.set("module", params.module);
    if (params.action) query.set("action", params.action);
    query.set("page", String(nextPage));
    return `/admin/logs?${query.toString()}`;
  }

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Sistem Kayıtları"
        description="Platform genelindeki aktivite ve audit log kayıtları."
      />

      <div className={`${appPanelClass} p-4`}>
        <form
          action="/admin/logs"
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
              defaultValue={params.q ?? ""}
              placeholder="Mesaj veya aksiyon ara..."
              className={`${appInputClass} pl-10`}
            />
          </label>
          <select
            name="module"
            defaultValue={params.module ?? "ALL"}
            className={appSelectClass}
          >
            <option value="ALL">Tüm modüller</option>
            <option value="admin">admin</option>
            <option value="auth">auth</option>
            <option value="sales">sales</option>
            <option value="membership-plans">membership-plans</option>
          </select>
          <select
            name="action"
            defaultValue={params.action ?? "ALL"}
            className={appSelectClass}
          >
            <option value="ALL">Tüm aksiyonlar</option>
            <option value="LOGIN">LOGIN</option>
            <option value="UPDATE">UPDATE</option>
            <option value="CREATE">CREATE</option>
          </select>
          <button type="submit" className={appPrimaryButtonClass}>
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Modül</th>
                <th className="px-3 py-2">Aksiyon</th>
                <th className="px-3 py-2">Mesaj</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Firma</th>
              </tr>
            </thead>
            <tbody>
              {logs.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                logs.items.map((log) => (
                  <tr key={log.id} className={appTableRowClass}>
                    <td className="px-3 py-3 text-slate-500">
                      {formatAdminDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getModuleClass(log.module)}`}
                      >
                        {log.module}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{log.action}</td>
                    <td className="px-3 py-3 text-slate-800">
                      {log.message || "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{log.userName}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {log.companyName ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-[12px] text-slate-500">
          <span>
            Toplam {logs.total} kayıt · Sayfa {logs.page}/{logs.totalPages}
          </span>
          <div className="flex gap-2">
            {logs.page > 1 ? (
              <Link
                href={pageHref(logs.page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Önceki
              </Link>
            ) : null}
            {logs.page < logs.totalPages ? (
              <Link
                href={pageHref(logs.page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}
