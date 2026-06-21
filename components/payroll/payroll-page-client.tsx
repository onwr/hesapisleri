"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  Hourglass,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import {
  getDefaultMonthRange,
  PayrollCreateModal,
} from "@/components/payroll/payroll-create-modal";
import { TeamActionButton } from "@/components/team/team-action-button";
import { formatMoney } from "@/lib/format-utils";
import type { SerializedPayrollRun } from "@/lib/payroll-service";
import {
  formatPayrollPeriodLabel,
  getPayrollRunStatusBadgeClass,
} from "@/lib/payroll-utils";
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

  const [runs] = useState(initialRuns);
  const [stats] = useState(initialStats);
  const [saving, setSaving] = useState(false);
  const [error] = useState("");
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

  function openCreateModal() {
    setCreateOpen(true);
    setFormError("");
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canManagePayroll ? (
          <TeamActionButton
            title="Yeni Bordro Dönemi"
            description="Dönem bordrosu oluştur"
            onClick={openCreateModal}
            icon={<Receipt size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a]"
          />
        ) : null}

        <ActionCard
          title="Çalışanlar"
          description="Personel listesine dön"
          href="/team"
          icon={<Users size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-blue-500 to-blue-600"
        />

        <ActionCard
          title="Performans Raporu"
          description="Personel performansını incele"
          href="/reports/personnel-performance"
          icon={<BarChart3 size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-emerald-500 to-green-600"
        />

        <ActionCard
          title="Kasa & Banka"
          description="Ödeme hesaplarını yönet"
          href="/cash-bank"
          icon={<Wallet size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-violet-500 to-purple-600"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Bu Ay Net Maaş"
          value={formatMoney(stats.monthlyNetTotal)}
          subtitle="Ödenen bordro net toplamı"
          icon={<Wallet size={18} />}
          color="green"
        />
        <StatCard
          title="Bekleyen Bordro"
          value={String(stats.pendingPayrollCount)}
          subtitle="Taslak ve onay bekleyen"
          highlight={
            stats.pendingPayrollCount > 0 ? "Onay veya ödeme bekliyor" : undefined
          }
          icon={<Hourglass size={18} />}
          color="orange"
        />
        <StatCard
          title="Ödenmiş Bordro"
          value={String(stats.paidPayrollCount)}
          subtitle="Tamamlanan dönemler"
          icon={<CheckCircle2 size={18} />}
          color="blue"
        />
        <StatCard
          title="Bekleyen Ödeme"
          value={String(stats.pendingSalaryPayments)}
          subtitle="Çalışan ödeme kaydı"
          icon={<CalendarDays size={18} />}
          color="purple"
        />
      </section>

      {isReadOnlyViewer ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Salt okunur görünüm: bordro kayıtlarını görüntüleyebilir ve onaylı
          bordrolarda toplu ödeme işaretleyebilirsiniz.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-[#0f1f4d]">
                Bordro Dönemleri
              </h2>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                Dönem bazlı maaş hesapları ve ödeme durumları
              </p>
            </div>

            {canManagePayroll ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]"
              >
                <Receipt size={14} />
                Yeni Dönem
              </button>
            ) : null}
          </div>

          {runs.length === 0 ? (
            <PayrollEmptyState
              canManagePayroll={canManagePayroll}
              onCreate={openCreateModal}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-4 py-3">Dönem</th>
                      <th className="px-4 py-3">Başlık</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">Çalışan</th>
                      <th className="px-4 py-3 text-right">Net Toplam</th>
                      <th className="px-4 py-3">Ödeme Tarihi</th>
                      <th className="px-4 py-3 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                          {formatPayrollPeriodLabel(
                            new Date(run.periodStart),
                            new Date(run.periodEnd)
                          )}
                        </td>

                        <td className="max-w-[220px] px-4 py-3">
                          <Link
                            href={`/team/payroll/${run.id}`}
                            className="truncate font-extrabold text-[#0f1f4d] hover:text-blue-600"
                          >
                            {run.title}
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                              getPayrollRunStatusBadgeClass(run.status),
                            ].join(" ")}
                          >
                            {run.statusLabel}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-bold text-[#0f1f4d]">
                          {run.employeeCount}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-black text-emerald-600">
                          {formatMoney(run.netTotal)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                          {run.payDate ? formatEmployeeDate(run.payDate) : "—"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <Link
                              href={`/team/payroll/${run.id}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Detay"
                            >
                              <Eye size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-slate-100 p-4 lg:hidden">
                {runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/team/payroll/${run.id}`}
                          className="block truncate text-[14px] font-extrabold text-[#0f1f4d]"
                        >
                          {run.title}
                        </Link>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {formatPayrollPeriodLabel(
                            new Date(run.periodStart),
                            new Date(run.periodEnd)
                          )}
                        </p>
                      </div>

                      <span
                        className={[
                          "inline-flex shrink-0 rounded-md px-2 py-1 text-[10px] font-black",
                          getPayrollRunStatusBadgeClass(run.status),
                        ].join(" ")}
                      >
                        {run.statusLabel}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                      <span>Net: {formatMoney(run.netTotal)}</span>
                      <span>Çalışan: {run.employeeCount}</span>
                      <span className="col-span-2">
                        Ödeme:{" "}
                        {run.payDate ? formatEmployeeDate(run.payDate) : "—"}
                      </span>
                    </div>

                    <Link
                      href={`/team/payroll/${run.id}`}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-[#0f1f4d]"
                    >
                      Detayı Gör
                      <ArrowRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-extrabold text-[#24345f]/80">
              Bordro Özeti
            </p>

            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Bu ay net maaş"
                value={formatMoney(stats.monthlyNetTotal)}
                tone="emerald"
              />
              <SummaryRow
                label="Bekleyen bordro"
                value={String(stats.pendingPayrollCount)}
                tone="orange"
              />
              <SummaryRow
                label="Ödenmiş bordro"
                value={String(stats.paidPayrollCount)}
                tone="blue"
              />
              <SummaryRow
                label="Bekleyen ödeme"
                value={String(stats.pendingSalaryPayments)}
                tone="violet"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
            <p className="text-[13px] font-black">Bordro Akışı</p>
            <p className="mt-2 text-[12px] leading-6 text-white/80">
              Dönem oluştur → hesapla → onayla → toplu ödeme kaydı oluştur.
            </p>
            {canManagePayroll ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
              >
                Yeni Bordro Dönemi
              </button>
            ) : (
              <Link
                href="/team"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
              >
                Çalışanlara Dön
              </Link>
            )}
          </div>
        </aside>
      </div>

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

function PayrollEmptyState({
  canManagePayroll,
  onCreate,
}: {
  canManagePayroll: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <Receipt size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          Henüz bordro kaydı yok
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          İlk bordro dönemini oluşturarak çalışan maaşlarını hesaplamaya
          başlayabilirsiniz.
        </p>

        {canManagePayroll ? (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
          >
            İlk Bordroyu Oluştur
          </button>
        ) : (
          <Link
            href="/team"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
          >
            Çalışanlara Dön
          </Link>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "orange" | "blue" | "violet";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "orange"
        ? "text-orange-600"
        : tone === "blue"
          ? "text-blue-600"
          : tone === "violet"
            ? "text-violet-600"
            : "text-[#0f1f4d]";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
    </div>
  );
}
