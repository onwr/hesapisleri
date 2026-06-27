"use client";

import Link from "next/link";
import { appTableClass, appTableHeadClass, appTableRowClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";

type ActivityData = {
  total: number;
  items: Array<{
    id: string;
    occurredAt: string;
    action: string;
    module: string;
    admin: { id: string; name: string | null; email: string; href: string } | null;
    source: string;
    success: boolean;
    ipMasked: string | null;
    description: string;
    entityHint: string | null;
  }>;
};

export function AdminPlanActivityTab({ data }: { planId: string; data: ActivityData | null }) {
  if (!data) return <p className="text-[12px] text-red-600">Aktivite yüklenemedi.</p>;

  return (
    <div>
      {data.items.length === 0 ? (
        <p className="text-[12px] text-slate-500">Plan kapsamlı aktivite kaydı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Tarih</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Admin</th>
                <th className="px-2 py-2">Sonuç</th>
                <th className="px-2 py-2">IP</th>
                <th className="px-2 py-2">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className={appTableRowClass}>
                  <td className="px-2 py-2 text-[10px]">{formatAdminDate(row.occurredAt)}</td>
                  <td className="px-2 py-2 text-[11px]">{row.action}</td>
                  <td className="px-2 py-2 text-[10px]">
                    {row.admin ? (
                      <Link href={row.admin.href}>{row.admin.name ?? row.admin.email}</Link>
                    ) : (
                      row.source
                    )}
                  </td>
                  <td className="px-2 py-2 text-[10px]">{row.success ? "Başarılı" : "Hata"}</td>
                  <td className="px-2 py-2 text-[10px]">{row.ipMasked ?? "—"}</td>
                  <td className="px-2 py-2 text-[10px]">{row.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
