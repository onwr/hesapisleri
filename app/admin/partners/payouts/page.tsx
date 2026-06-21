import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  adminPanelClass,
  adminTableClass,
  adminTableHeadClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";
import { listAdminPayouts } from "@/lib/partner-service";

export default async function AdminPartnerPayoutsPage() {
  const payouts = await listAdminPayouts();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Partner Ödemeleri"
        description="Partnerlere yapılan nakit ödemeleri görüntüleyin."
      />

      <div className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className={adminTableClass}>
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Yöntem</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Oluşturma</th>
                <th className="px-3 py-2">Ödeme</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/partners/${payout.partnerId}`}
                      className="font-bold text-slate-800 hover:underline"
                    >
                      {payout.partnerName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px]">{payout.referralCode}</td>
                  <td className="px-3 py-3">{formatAdminMoney(payout.amount)}</td>
                  <td className="px-3 py-3">{payout.paymentMethod}</td>
                  <td className="px-3 py-3">{payout.status}</td>
                  <td className="px-3 py-3">{formatAdminDate(payout.createdAt)}</td>
                  <td className="px-3 py-3">
                    {payout.paidAt ? formatAdminDate(payout.paidAt) : "—"}
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
