"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import {
  getDefaultMonthRange,
  PayrollCreateModal,
} from "@/components/payroll/payroll-create-modal";
import { TEAM_CARD_CLASS, TEAM_HERO_GRADIENT } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import type { SerializedPayrollRun } from "@/lib/payroll-service";
import { formatPayrollPeriodLabel, getPayrollRunStatusBadgeClass } from "@/lib/payroll-utils";
import { formatEmployeeDate } from "@/lib/employee-page-utils";

type PayrollStats = {
  monthlyNetTotal: number;
  pendingPayrollCount: number;
  paidPayrollCount: number;
  pendingSalaryPayments: number;
};

type PayrollPageClientProps = {
  initialRuns: SerializedPayrollRun[];
  initialStats: PayrollStats;
  canManagePayroll: boolean;
  isReadOnlyViewer?: boolean;
};

export function PayrollPageClient({
  initialRuns,
  initialStats,
  canManagePayroll,
  isReadOnlyViewer = false,
}: PayrollPageClientProps) {
  const router = useRouter();
  const defaults = getDefaultMonthRange();

  const [runs, setRuns] = useState(initialRuns);
  const [stats, setStats] = useState(initialStats);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);
  const [payDate, setPayDate] = useState(defaults.payDate);
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<{
    employeeCount: number;
    grossTotal: number;
    bonusTotal: number;
    deductionTotal: number;
    netTotal: number;
    warnings: Array<{ employeeId: string; employeeName: string; reason: string }>;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formError, setFormError] = useState("");

  async function reload() {
    const [runsRes, statsRes] = await Promise.all([
      fetch("/api/payroll/runs"),
      fetch("/api/payroll/stats"),
    ]);
    const runsJson = await runsRes.json();
    const statsJson = await statsRes.json();
    if (runsJson.success) setRuns(runsJson.payrollRuns);
    if (statsJson.success) setStats(statsJson.stats);
  }

  useEffect(() => {
    if (!createOpen || !periodStart || !periodEnd) return;

    let cancelled = false;
    setPreviewLoading(true);

    fetch("/api/payroll/runs/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, periodEnd }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) setPreview(json.preview);
        else setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [createOpen, periodStart, periodEnd]);

  async function handleCreate() {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          payDate: payDate || undefined,
          title: title || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.message ?? "Bordro oluşturulamadı.");
        return;
      }
      setCreateOpen(false);
      router.push(`/team/payroll/${json.payrollRun.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/team"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Çalışanlara dön
      </Link>

      <section
        className={[
          "overflow-hidden rounded-[1.75rem] p-6 text-white shadow-[0_24px_60px_rgba(15,31,77,0.22)] sm:p-8",
          TEAM_HERO_GRADIENT,
        ].join(" ")}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100/80">
              Personel / İK
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.03em]">Bordro</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/90">
              Çalışan maaşlarını dönem bazlı hesaplayın, onaylayın ve toplu ödeme
              oluşturun.
            </p>
          </div>
          {canManagePayroll ? (
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setFormError("");
              }}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#0f1f4d]"
            >
              <Plus size={18} />
              Yeni Bordro Dönemi
            </button>
          ) : null}
        </div>
      </section>

      {isReadOnlyViewer ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          Salt okunur görünüm: bordro kayıtlarını görüntüleyebilir ve onaylı
          bordrolarda toplu ödeme işaretleyebilirsiniz.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Bu ay net maaş toplamı", value: formatMoney(stats.monthlyNetTotal) },
          { label: "Bekleyen bordro", value: String(stats.pendingPayrollCount) },
          { label: "Ödenmiş bordro", value: String(stats.paidPayrollCount) },
          {
            label: "Bekleyen çalışan ödemesi",
            value: String(stats.pendingSalaryPayments),
          },
        ].map((stat) => (
          <div key={stat.label} className={TEAM_CARD_CLASS}>
            <p className="text-[11px] font-black uppercase text-slate-400">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-black text-[#0f1f4d]">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className={TEAM_CARD_CLASS}>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                <th className="py-2 pr-4">Dönem</th>
                <th className="py-2 pr-4">Başlık</th>
                <th className="py-2 pr-4">Durum</th>
                <th className="py-2 pr-4">Çalışan</th>
                <th className="py-2 pr-4">Net toplam</th>
                <th className="py-2">Ödeme tarihi</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 text-slate-500">
                    {formatPayrollPeriodLabel(
                      new Date(run.periodStart),
                      new Date(run.periodEnd)
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/team/payroll/${run.id}`}
                      className="font-black text-[#0f1f4d] hover:underline"
                    >
                      {run.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                        getPayrollRunStatusBadgeClass(run.status),
                      ].join(" ")}
                    >
                      {run.statusLabel}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{run.employeeCount}</td>
                  <td className="py-3 pr-4 font-black text-[#0f1f4d]">
                    {formatMoney(run.netTotal)}
                  </td>
                  <td className="py-3 text-slate-500">
                    {run.payDate ? formatEmployeeDate(run.payDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Henüz bordro kaydı yok.
            </p>
          ) : null}
        </div>
      </section>

      <PayrollCreateModal
        open={createOpen}
        saving={saving}
        periodStart={periodStart}
        periodEnd={periodEnd}
        payDate={payDate}
        title={title}
        preview={preview}
        previewLoading={previewLoading}
        formError={formError}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
        onPayDateChange={setPayDate}
        onTitleChange={setTitle}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
