import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import type { ReactNode } from "react";
import Link from "next/link";
import { AdminCompanyActions } from "@/components/admin/admin-company-actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusClass,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type { getAdminCompanyDetail } from "@/lib/admin-service";

type CompanyDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminCompanyDetail>>
>;

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function AdminCompanyDetailContent({
  company,
}: {
  company: CompanyDetail;
}) {
  return (
    <AdminPageContainer size="full">
    <div>
      <AdminPageHeader
        title={company.name}
        description="Firma bilgileri, üyelik durumu ve operasyonel özet."
        backHref="/admin/companies"
      />

      <div className="mb-6">
        <AdminCompanyActions
          companyId={company.id}
          companyName={company.name}
          status={company.status}
          membershipStatus={company.settings.membershipStatus}
          nextPaymentDate={company.settings.nextPaymentDate}
          monthlyFee={company.settings.monthlyFee}
          membershipNote={company.settings.membershipNote}
          mode="detail"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Firma Bilgileri
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 text-[13px]">
              <Info label="Durum">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getCompanyStatusClass(company.status)}`}
                >
                  {getCompanyStatusLabel(company.status)}
                </span>
              </Info>
              <Info label="Vergi No">{company.taxNo ?? "—"}</Info>
              <Info label="Vergi Dairesi">{company.taxOffice ?? "—"}</Info>
              <Info label="Telefon">{company.phone ?? "—"}</Info>
              <Info label="E-posta">{company.email ?? "—"}</Info>
              <Info label="Oluşturulma">
                {formatAdminDateTime(company.createdAt)}
              </Info>
              <Info label="Adres" full>
                {company.address ?? "—"}
              </Info>
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Kullanıcılar
            </h2>
            <div className="space-y-2">
              {company.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-[#0f1f4d]">{user.name}</p>
                    <p className="text-[12px] text-slate-500">{user.email}</p>
                  </div>
                  <div className="text-right text-[12px]">
                    <p className="font-bold text-slate-600">{user.role}</p>
                    <p className="text-slate-400">{user.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ListCard
              title="Son Satışlar"
              items={company.recentSales.map((sale) => ({
                id: sale.id,
                title: sale.saleNo,
                subtitle: sale.customerName,
                value: formatAdminMoney(sale.total),
                href: `/sales/${sale.id}`,
              }))}
            />
            <ListCard
              title="Son Faturalar"
              items={company.recentInvoices.map((invoice) => ({
                id: invoice.id,
                title: invoice.invoiceNo,
                subtitle: invoice.customerName,
                value: formatAdminMoney(invoice.total),
                href: `/invoices/${invoice.id}`,
              }))}
            />
            <ListCard
              title="Son Giderler"
              items={company.recentExpenses.map((expense) => ({
                id: expense.id,
                title: expense.title,
                subtitle: formatAdminDate(expense.createdAt),
                value: formatAdminMoney(expense.amount),
                href: `/expenses/${expense.id}`,
              }))}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div id="membership" className={`${cardClassName} scroll-mt-24`}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Üyelik Bilgileri
            </h2>
            <div className="space-y-3 text-[13px]">
              <Info label="Üyelik Durumu">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getMembershipStatusClass(company.settings.membershipStatus)}`}
                >
                  {getMembershipStatusLabel(company.settings.membershipStatus)}
                </span>
              </Info>
              <Info label="Aylık Ücret">
                {formatAdminMoney(company.settings.monthlyFee)}
              </Info>
              <Info label="Son Ödeme">
                {formatAdminDate(company.settings.lastPaymentDate)}
              </Info>
              <Info label="Sonraki Ödeme">
                {formatAdminDate(company.settings.nextPaymentDate)}
              </Info>
              <Info label="Not" full>
                {company.settings.membershipNote ?? "—"}
              </Info>
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Finans Özeti
            </h2>
            <div className="space-y-3">
              <Metric label="Kasa/Banka Toplamı" value={formatAdminMoney(company.finance.totalAccountBalance)} />
              <Metric label="Cari Alacak" value={formatAdminMoney(company.finance.receivable)} />
              <Metric label="Cari Borç" value={formatAdminMoney(company.finance.payable)} />
              <Metric label="Aktif Hesap" value={String(company.finance.accountsCount)} />
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Firma Ayarları
            </h2>
            <div className="space-y-2 text-[13px] text-slate-600">
              <p>Para birimi: {company.settings.currency}</p>
              <p>Varsayılan KDV: %{company.settings.defaultVatRate}</p>
              <p>Fatura tipi: {company.settings.defaultInvoiceType}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AdminPageContainer>
  );
}

function Info({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 font-semibold text-[#0f1f4d]">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-[13px] font-medium text-slate-500">{label}</span>
      <span className="text-[14px] font-extrabold text-[#0f1f4d]">{value}</span>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    value: string;
    href?: string;
  }>;
}) {
  return (
    <div className={cardClassName}>
      <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-500">Kayıt yok.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-3 py-2.5"
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="font-bold text-blue-600 hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <p className="font-bold text-[#0f1f4d]">{item.title}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
                <span className="text-slate-500">{item.subtitle}</span>
                <span className="font-bold text-[#0f1f4d]">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
