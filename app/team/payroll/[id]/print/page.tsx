import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PayrollPrintButton } from "@/components/payroll/payroll-print-button";
import { getAppSession } from "@/lib/app-session";
import { canAccessEmployees } from "@/lib/permission-utils";
import { formatMoney } from "@/lib/format-utils";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import { getPayrollDetailPageData } from "@/lib/payroll-page-data";
import { PayrollServiceError } from "@/lib/payroll-service";
import {
  formatPayrollPeriodLabel,
  PAYROLL_RUN_STATUS_LABELS,
} from "@/lib/payroll-utils";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PayrollPrintPage({ params }: Props) {
  const session = await getAppSession();
  const { id } = await params;

  const canView = canAccessEmployees(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  if (!canView) {
    notFound();
  }

  try {
    const { payrollRun } = await getPayrollDetailPageData({
      companyId: session.company.id,
      payrollRunId: id,
    });

    const periodLabel = formatPayrollPeriodLabel(
      new Date(payrollRun.periodStart),
      new Date(payrollRun.periodEnd)
    );

    return (
      <div className="min-h-screen bg-white px-6 py-8 text-slate-900 print:p-0">
        <style>{`
          @media print {
            @page { margin: 16mm; }
            body { background: white; }
          }
        `}</style>

        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between gap-4 print:hidden">
            <Link
              href={`/team/payroll/${id}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
            >
              <ArrowLeft size={16} />
              Bordroya dön
            </Link>
            <PayrollPrintButton />
          </div>

          <header className="border-b border-slate-200 pb-6">
            <p className="text-sm font-semibold text-slate-500">
              {session.company.name}
            </p>
            <h1 className="mt-2 text-3xl font-black text-[#0f1f4d]">
              {payrollRun.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>Dönem: {periodLabel}</span>
              <span>
                Ödeme tarihi:{" "}
                {payrollRun.payDate
                  ? formatEmployeeDate(payrollRun.payDate)
                  : "—"}
              </span>
              <span>
                Durum:{" "}
                {PAYROLL_RUN_STATUS_LABELS[payrollRun.status]}
              </span>
            </div>
          </header>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs font-black uppercase text-slate-500">
                <th className="py-2 pr-3">Çalışan</th>
                <th className="py-2 pr-3">Departman</th>
                <th className="py-2 pr-3">Görev</th>
                <th className="py-2 pr-3 text-right">Baz Maaş</th>
                <th className="py-2 pr-3 text-right">Prim</th>
                <th className="py-2 pr-3 text-right">Kesinti</th>
                <th className="py-2 pr-3 text-right">Avans</th>
                <th className="py-2 pr-3 text-right">Net</th>
                <th className="py-2">Not</th>
              </tr>
            </thead>
            <tbody>
              {payrollRun.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold">{item.employeeName}</td>
                  <td className="py-2 pr-3">{item.department ?? "—"}</td>
                  <td className="py-2 pr-3">{item.jobTitle ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">{formatMoney(item.baseSalary)}</td>
                  <td className="py-2 pr-3 text-right">{formatMoney(item.bonusAmount)}</td>
                  <td className="py-2 pr-3 text-right">
                    {formatMoney(item.deductionAmount)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatMoney(item.advanceDeduction)}
                  </td>
                  <td className="py-2 pr-3 text-right font-black">
                    {formatMoney(item.netPayable)}
                  </td>
                  <td className="py-2 text-slate-600">{item.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-black">
                <td className="py-3 pr-3" colSpan={3}>
                  Toplam ({payrollRun.employeeCount} çalışan)
                </td>
                <td className="py-3 pr-3 text-right">
                  {formatMoney(payrollRun.grossTotal)}
                </td>
                <td className="py-3 pr-3 text-right">
                  {formatMoney(payrollRun.bonusTotal)}
                </td>
                <td className="py-3 pr-3 text-right">
                  {formatMoney(payrollRun.deductionTotal)}
                </td>
                <td className="py-3 pr-3" />
                <td className="py-3 pr-3 text-right">
                  {formatMoney(payrollRun.netTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          <div className="grid gap-8 pt-10 sm:grid-cols-2">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-xs font-black uppercase text-slate-400">
                Hazırlayan
              </p>
              <p className="mt-10 text-sm text-slate-500">İmza / Tarih</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-xs font-black uppercase text-slate-400">
                Onaylayan
              </p>
              <p className="mt-10 text-sm text-slate-500">İmza / Tarih</p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof PayrollServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
