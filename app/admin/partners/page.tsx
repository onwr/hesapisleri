import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  adminPanelClass,
  adminTableClass,
  adminTableHeadClass,
} from "@/lib/admin-ui";
import { formatAdminMoney } from "@/lib/admin-utils";
import { listAdminPartners } from "@/lib/partner-service";
import { getPartnerBadgeClass } from "@/lib/partner-utils";

export default async function AdminPartnersPage() {
  const partners = await listAdminPartners();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Ortaklık Programı"
        description="Onaylı partnerleri yönetin, komisyon oranlarını ve rozetleri düzenleyin."
      />

      <div className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className={adminTableClass}>
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Komisyon</th>
                <th className="px-3 py-2">Rozet</th>
                <th className="px-3 py-2">Tıklama</th>
                <th className="px-3 py-2">Kayıt</th>
                <th className="px-3 py-2">Kazanç</th>
                <th className="px-3 py-2">Ödenen</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-900">{partner.fullName}</p>
                    <p className="text-[12px] text-slate-400">{partner.email}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px]">{partner.referralCode}</td>
                  <td className="px-3 py-3">%{partner.commissionRate}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${getPartnerBadgeClass(partner.badgeType)}`}
                    >
                      {partner.badgeLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3">{partner.clicks}</td>
                  <td className="px-3 py-3">{partner.signups}</td>
                  <td className="px-3 py-3">{formatAdminMoney(partner.earnings)}</td>
                  <td className="px-3 py-3">{formatAdminMoney(partner.paidTotal)}</td>
                  <td className="px-3 py-3">{partner.status}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/partners/${partner.id}`}
                      className="font-bold text-slate-700 hover:underline"
                    >
                      Detay
                    </Link>
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
