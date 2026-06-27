"use client";

import Link from "next/link";
import { appPanelClass, appTableClass, appTableHeadClass, appTableRowClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";

type HistoryData = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: Array<{
    eventId: string;
    occurredAt: string;
    eventType: string;
    source: string;
    category: string;
    actorLabel: string;
    beforeSummary: string | null;
    afterSummary: string | null;
    reason: string | null;
    relatedTab: string | null;
    success: boolean;
  }>;
};

export function AdminPlanHistoryTab({ planId, data }: { planId: string; data: HistoryData | null }) {
  if (!data) return <p className="text-[12px] text-red-600">Geçmiş yüklenemedi.</p>;

  return (
    <div>
      <div className={`${appPanelClass} mb-4 p-3 text-[12px] text-slate-600`}>
        Plan yaşam döngüsü olayları — duplicate audit/model kayıtları birleştirilmiştir.
      </div>
      {data.items.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz geçmiş kaydı yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Tarih</th>
                <th className="px-2 py-2">Olay</th>
                <th className="px-2 py-2">Kaynak</th>
                <th className="px-2 py-2">Yapan</th>
                <th className="px-2 py-2">Önce</th>
                <th className="px-2 py-2">Sonra</th>
                <th className="px-2 py-2">Sebep</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.eventId} className={appTableRowClass}>
                  <td className="px-2 py-2 text-[10px]">{formatAdminDate(row.occurredAt)}</td>
                  <td className="px-2 py-2 text-[11px]">
                    {row.eventType}
                    {row.relatedTab ? (
                      <Link
                        href={`/admin/plans/${planId}?tab=${row.relatedTab}`}
                        className="ml-1 text-blue-700"
                      >
                        →
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-[10px]">{row.source}</td>
                  <td className="px-2 py-2 text-[10px]">{row.actorLabel}</td>
                  <td className="px-2 py-2 text-[10px]">{row.beforeSummary ?? "—"}</td>
                  <td className="px-2 py-2 text-[10px]">{row.afterSummary ?? "—"}</td>
                  <td className="px-2 py-2 text-[10px]">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
