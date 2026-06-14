"use client";

import Link from "next/link";
import { ArrowRight, Calculator, Wallet } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import type { SerializedPayrollRun } from "@/lib/payroll-service";
import { getPayrollRunStatusBadgeClass } from "@/lib/payroll-utils";

type TeamPayrollCardProps = {
  stats: {
    monthlyNetTotal: number;
    pendingPayrollCount: number;
    pendingSalaryPayments: number;
  };
  recentRuns: SerializedPayrollRun[];
  canManage: boolean;
  onCreatePayroll: () => void;
};

export function TeamPayrollCard({
  stats,
  recentRuns,
  canManage,
  onCreatePayroll,
}: TeamPayrollCardProps) {
  return (
    <section className={TEAM_CARD_CLASS}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700">
            <Calculator size={14} />
            Bordro ve Toplu Maaş
          </div>
          <p className="mt-3 max-w-xl text-sm text-slate-600">
            Çalışan maaşlarını dönem bazlı hesaplayın, onaylayın ve toplu ödeme
            oluşturun.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              onClick={onCreatePayroll}
              className="inline-flex h-10 items-center rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white"
            >
              Bu ay bordro oluştur
            </button>
          ) : null}
          <Link
            href="/team/payroll"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
          >
            Bordrolar
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-400">
            Bu ay net maaş
          </p>
          <p className="mt-2 text-lg font-black text-[#0f1f4d]">
            {formatMoney(stats.monthlyNetTotal)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-400">
            Bekleyen bordro
          </p>
          <p className="mt-2 text-lg font-black text-amber-600">
            {stats.pendingPayrollCount}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-400">
            Bekleyen maaş ödemesi
          </p>
          <p className="mt-2 text-lg font-black text-orange-600">
            {stats.pendingSalaryPayments}
          </p>
        </div>
      </div>

      {recentRuns.length > 0 ? (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            Son bordrolar
          </p>
          {recentRuns.map((run) => (
            <Link
              key={run.id}
              href={`/team/payroll/${run.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-black text-[#0f1f4d]">{run.title}</p>
                <p className="text-xs text-slate-500">
                  {run.employeeCount} çalışan · {formatMoney(run.netTotal)}
                </p>
              </div>
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                  getPayrollRunStatusBadgeClass(run.status),
                ].join(" ")}
              >
                {run.statusLabel}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
          <Wallet size={18} />
          Henüz bordro kaydı yok.
        </div>
      )}
    </section>
  );
}
