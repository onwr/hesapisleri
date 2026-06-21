import Link from "next/link";
import {
  Banknote,
  Calendar,
  CircleAlert,
  Clock,
  RotateCcw,
} from "lucide-react";
import { AdminMembershipPaymentActions } from "@/components/admin/admin-membership-payment-actions";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";
import { getAdminPaymentsSummary } from "@/lib/admin-service";
import { listAdminMembershipPayments } from "@/lib/membership-service";

function getPaymentStatusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING") return "bg-orange-100 text-orange-700";
  if (status === "FAILED") return "bg-rose-100 text-rose-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-700";
  if (status === "REFUNDED") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminPaymentsPage() {
  const [payments, summary] = await Promise.all([
    listAdminMembershipPayments(),
    getAdminPaymentsSummary(),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Üyelik Ödemeleri"
        description="Platform üyelik ödemelerini onaylayın ve tahsilat durumlarını izleyin."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          title="Toplam Tahsilat"
          value={formatAdminMoney(summary.paidTotal)}
          icon={Banknote}
          tone="green"
        />
        <AdminStatCard
          title="Bu Ay Tahsilat"
          value={formatAdminMoney(summary.monthPaid)}
          icon={Calendar}
          tone="blue"
        />
        <AdminStatCard
          title="Bekleyen"
          value={String(summary.pending)}
          icon={Clock}
          tone="amber"
        />
        <AdminStatCard
          title="Başarısız"
          value={String(summary.failed)}
          icon={CircleAlert}
          tone="red"
        />
        <AdminStatCard
          title="İade"
          value={String(summary.refunded)}
          icon={RotateCcw}
          tone="purple"
        />
      </div>

      <div className={`${appPanelClass} p-4`}>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Plan/Dönem</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Ödeme Tipi</th>
                <th className="px-3 py-2">Merchant OID</th>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/companies/${payment.company.id}`}
                      className="font-bold text-slate-800 hover:underline"
                    >
                      {payment.company.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {payment.planName}
                    <p className="text-[11px] text-slate-400">{payment.periodLabel}</p>
                  </td>
                  <td className="px-3 py-3 font-bold text-slate-900">
                    {formatAdminMoney(payment.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getPaymentStatusClass(payment.status)}`}
                    >
                      {payment.statusLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {payment.provider ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {payment.type ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                    {payment.merchantOid ?? payment.paymentRef ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {payment.testMode ? "Test" : "Canlı"}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {formatAdminDate(payment.paidAt ?? payment.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <AdminMembershipPaymentActions
                      paymentId={payment.id}
                      status={payment.status}
                      amountMinor={payment.amountMinor}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageContainer>
  );
}
