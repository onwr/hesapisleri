"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";

type JobDetail = {
  key: string;
  label: string;
  categoryLabel: string;
  description: string;
  scheduleHint: string;
  criticality: string;
  manualRunSupported: boolean;
  cronRoute: string;
  currentStatus: string;
  timeoutMs: number;
  concurrencyPolicy: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  suggestedAction: string | null;
};

type RunItem = {
  id: string;
  status: string;
  trigger: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string | null;
  errorCode: string | null;
  triggeredBy: { name: string | null; email: string } | null;
};

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
};

export function AdminJobDetailContent({
  job,
  runs,
  activity,
  tab,
}: {
  job: JobDetail;
  runs: { items: RunItem[]; pagination: { page: number; totalPages: number } };
  activity: ActivityItem[];
  tab: string;
}) {
  const router = useRouter();
  const [runOpen, setRunOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitRun() {
    if (submitting || !confirm || !reason.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/jobs/${job.key}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), confirm: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Çalıştırma başarısız.");
      setRunOpen(false);
      setReason("");
      setConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Çalıştırma başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "runs", label: "Runs" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={job.label}
        description={job.description}
        secondaryActions={
          <>
            <Link href="/admin/jobs" className={appOutlineButtonClass}>
              Listeye dön
            </Link>
            {job.manualRunSupported ? (
              <button type="button" className={appPrimaryButtonClass} onClick={() => setRunOpen(true)}>
                Manuel Çalıştır
              </button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/jobs/${job.key}?tab=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
              tab === t.id ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className={`${appPanelClass} grid gap-4 p-4 sm:grid-cols-2`}>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Kategori</p>
            <p className="text-[13px]">{job.categoryLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Schedule</p>
            <p className="text-[13px]">{job.scheduleHint}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Timeout</p>
            <p className="text-[13px]">{job.timeoutMs}ms</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Concurrency</p>
            <p className="text-[13px]">{job.concurrencyPolicy}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Cron route</p>
            <p className="font-mono text-[12px]">{job.cronRoute}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Durum</p>
            <p className="text-[13px]">{job.currentStatus}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Son başarı</p>
            <p className="text-[13px]">{job.lastSuccessAt ? formatAdminDateTime(job.lastSuccessAt) : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500">Son hata</p>
            <p className="text-[13px]">{job.lastFailureAt ? formatAdminDateTime(job.lastFailureAt) : "—"}</p>
          </div>
          {job.suggestedAction ? (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">Önerilen aksiyon</p>
              <p className="text-[13px] text-amber-800">{job.suggestedAction}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "runs" ? (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Süre</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Özet</th>
                <th className="px-3 py-2">Hata</th>
              </tr>
            </thead>
            <tbody>
              {runs.items.map((run) => (
                <tr key={run.id} className={appTableRowClass}>
                  <td className="px-3 py-2 text-[12px] text-slate-500">
                    {run.startedAt ? formatAdminDateTime(run.startedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px]">{run.trigger}</td>
                  <td className="px-3 py-2 text-[12px] font-semibold">{run.status}</td>
                  <td className="px-3 py-2 text-[12px]">{run.durationMs ?? "—"}ms</td>
                  <td className="px-3 py-2 text-[12px]">{run.triggeredBy?.email ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-[12px]">{run.summary ?? "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-rose-600">{run.errorCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className={`${appPanelClass} space-y-3 p-4`}>
          {activity.length === 0 ? (
            <p className="text-[13px] text-slate-500">Activity kaydı yok.</p>
          ) : (
            activity.map((row) => (
              <div key={row.id} className="border-b border-slate-100 pb-2 text-[12px]">
                <p className="font-semibold text-slate-800">
                  {row.action} · {formatAdminDateTime(row.createdAt)}
                </p>
                <p className="text-slate-600">{row.message ?? "—"}</p>
                <p className="text-slate-500">{row.user?.email ?? "Sistem"}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {runOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md space-y-3 p-5`}>
            <h2 className="text-lg font-bold">Manuel Çalıştır</h2>
            <p className="text-[13px] text-slate-600">{job.label}</p>
            {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
            <label className="block text-[13px]">
              Gerekçe
              <textarea className="mt-1 w-full rounded border px-3 py-2" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Bu job'u manuel çalıştırmayı onaylıyorum
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setRunOpen(false)} disabled={submitting}>
                Vazgeç
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={submitting || !confirm || !reason.trim()}
                onClick={() => void submitRun()}
              >
                {submitting ? "Çalışıyor…" : "Çalıştır"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
