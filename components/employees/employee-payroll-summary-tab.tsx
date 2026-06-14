"use client";

import Link from "next/link";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeePayrollSummaryTabProps = {
  employee: SerializedEmployee;
};

export function EmployeePayrollSummaryTab({
  employee,
}: EmployeePayrollSummaryTabProps) {
  const lastPaidPayment = (employee.payments ?? []).find((p) => p.status === "PAID");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          title="Aktif maaş"
          value={
            employee.activeSalary
              ? `${formatMoney(employee.activeSalary.amount)} / ${employee.activeSalary.periodLabel}`
              : "—"
          }
        />
        <SummaryCard
          title="Son bordro ödemesi"
          value={
            lastPaidPayment
              ? `${formatMoney(lastPaidPayment.amount)} · ${lastPaidPayment.statusLabel}`
              : "Kayıt yok"
          }
        />
        <SummaryCard
          title="Bekleyen ödeme"
          value={formatMoney(employee.balance.netPayable)}
        />
      </div>

      <div className={[TEAM_CARD_CLASS, "p-4"].join(" ")}>
        <p className="text-sm font-medium text-slate-600">
          Bordro oluşturma, onaylama ve toplu ödeme işlemleri bordro sayfasında
          yapılır.
        </p>
        <Link
          href="/team/payroll"
          className="mt-3 inline-flex rounded-2xl bg-[#0f1f4d] px-4 py-2.5 text-xs font-black text-white"
        >
          Bordro sayfasına git
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className={[TEAM_CARD_CLASS, "p-4"].join(" ")}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-lg font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}
