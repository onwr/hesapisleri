import Link from "next/link";
import { AdminNavTabs } from "@/components/admin/admin-nav-tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";
import { db } from "@/lib/prisma";

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

function getPaymentStatusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING") return "bg-orange-100 text-orange-700";
  if (status === "FAILED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminPaymentsPage() {
  const payments = await db.membershipPayment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { company: true },
  });

  const paidTotal = payments
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const pendingCount = payments.filter((item) => item.status === "PENDING").length;

  return (
    <div>
      <AdminPageHeader
        title="Üyelik Ödemeleri"
        description="Platform üyelik ödemelerini ve tahsilat durumlarını izleyin."
      />
      <AdminNavTabs />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={cardClassName}>
          <p className="text-[12px] font-bold text-slate-500">Toplam Tahsilat</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#0f1f4d]">
            {formatAdminMoney(paidTotal)}
          </p>
        </div>
        <div className={cardClassName}>
          <p className="text-[12px] font-bold text-slate-500">Bekleyen Ödeme</p>
          <p className="mt-2 text-[24px] font-extrabold text-orange-600">
            {pendingCount}
          </p>
        </div>
        <div className={cardClassName}>
          <p className="text-[12px] font-bold text-slate-500">Kayıt Sayısı</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#0f1f4d]">
            {payments.length}
          </p>
        </div>
      </div>

      <div className={cardClassName}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Dönem</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Ödeme Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/companies/${payment.companyId}`}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      {payment.company.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatAdminDate(payment.periodStart)} -{" "}
                    {formatAdminDate(payment.periodEnd)}
                  </td>
                  <td className="px-3 py-3 font-bold text-[#0f1f4d]">
                    {formatAdminMoney(Number(payment.amount))}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getPaymentStatusClass(payment.status)}`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {formatAdminDate(payment.paidAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
