import { AdminNavTabs } from "@/components/admin/admin-nav-tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { db } from "@/lib/prisma";

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

function getModuleClass(module: string) {
  if (module === "admin") return "bg-slate-900 text-white";
  if (module === "auth") return "bg-blue-100 text-blue-700";
  if (module === "sales") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminLogsPage() {
  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: true,
      company: true,
    },
  });

  return (
    <div>
      <AdminPageHeader
        title="Sistem Kayıtları"
        description="Platform genelindeki aktivite ve audit log kayıtları."
      />
      <AdminNavTabs />

      <div className={cardClassName}>
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getModuleClass(log.module)}`}
                  >
                    {log.module}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {log.action}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-[#0f1f4d]">
                  {log.message || "—"}
                </p>
                <p className="text-[12px] text-slate-500">
                  {log.user?.name ?? "Sistem"}
                  {log.company ? ` · ${log.company.name}` : ""}
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
