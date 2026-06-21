import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  adminPanelClass,
  adminTableClass,
  adminTableHeadClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";
import { getAdminPartnerDetail } from "@/lib/partner-service";
import { getPartnerBadgeClass } from "@/lib/partner-utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPartnerDetailPage({ params }: PageProps) {
  const { id } = await params;

  let data;
  try {
    data = await getAdminPartnerDetail(id);
  } catch {
    notFound();
  }

  const { partner, clicks, conversions, earnings, payouts } = data;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={partner.fullName}
        description={`${partner.email} · ${partner.referralCode}`}
        backHref="/admin/partners"
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className={adminPanelClass}>
          <p className="text-[12px] font-bold text-slate-500">Komisyon</p>
          <p className="mt-2 text-[22px] font-extrabold">%{partner.commissionRate}</p>
        </div>
        <div className={adminPanelClass}>
          <p className="text-[12px] font-bold text-slate-500">Rozet</p>
          <span
            className={`mt-2 inline-flex rounded-md border px-3 py-1 text-[12px] font-bold ${getPartnerBadgeClass(partner.badgeType)}`}
          >
            {partner.badgeLabel}
          </span>
        </div>
        <div className={adminPanelClass}>
          <p className="text-[12px] font-bold text-slate-500">Referans Linki</p>
          <a
            href={partner.referralUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-[13px] font-bold text-slate-700 hover:underline"
          >
            {partner.referralUrl}
          </a>
        </div>
      </div>

      <Section
        title="Tıklamalar"
        rows={clicks.map((row) => [
          row.clickedAt,
          row.referralCode,
          row.converted ? "Evet" : "Hayır",
        ])}
        headers={["Tarih", "Kod", "Dönüştü"]}
      />
      <Section
        title="Dönüşümler"
        rows={conversions.map((row) => [
          row.occurredAt,
          row.typeLabel,
          row.companyName ?? "—",
          formatAdminMoney(row.amount),
          formatAdminMoney(row.commissionAmount),
        ])}
        headers={["Tarih", "Tip", "Firma", "Tutar", "Komisyon"]}
      />
      <Section
        title="Kazançlar"
        rows={earnings.map((row) => [
          row.createdAt,
          formatAdminMoney(row.amount),
          row.statusLabel,
        ])}
        headers={["Tarih", "Tutar", "Durum"]}
      />
      <Section
        title="Ödemeler"
        rows={payouts.map((row) => [
          row.createdAt,
          formatAdminMoney(row.amount),
          row.paymentMethod,
          row.status,
        ])}
        headers={["Tarih", "Tutar", "Yöntem", "Durum"]}
      />

      {partner.notes ? (
        <div className={`${adminPanelClass} mt-4`}>
          <p className="text-[12px] font-bold text-slate-500">Notlar</p>
          <p className="mt-2 text-[14px] text-slate-700">{partner.notes}</p>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}

function Section({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className={`${adminPanelClass} mb-4`}>
      <h3 className="mb-3 text-[15px] font-bold text-slate-900">{title}</h3>
      <div className="overflow-x-auto">
        <table className={adminTableClass}>
          <thead>
            <tr className={adminTableHeadClass}>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-4 text-center text-slate-400">
                  Kayıt yok
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-50 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-3">
                      {cellIndex === 0 ? formatAdminDate(cell) : cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
