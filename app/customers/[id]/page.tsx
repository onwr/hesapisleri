import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShoppingCart,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { CustomerCollectPanel } from "@/components/customers/customer-collect-panel";
import { CustomerLedgerTable } from "@/components/customers/customer-ledger-table";
import { db } from "@/lib/prisma";
import { getCustomerDetailLedgerData } from "@/lib/customer-detail-data";
import { getCustomerGroupColorMap } from "@/lib/customer-group-service";
import { normalizeGroupName } from "@/lib/customer-group-utils";
import {
  buildSingleCustomerExportHref,
  formatCustomerMoney,
  getCustomerStatusBadge,
  getGroupBadge,
  getInitials,
} from "@/lib/customers-page-utils";
import { hasCustomerTaxCertificate } from "@/lib/customer-form-utils";

type Props = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
        {icon}
      </div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  valueClass = "text-[#0f1f4d]",
  icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3">
      <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
    </div>
  );
}

export default async function CustomerDetailPage({ params,
  searchParams,
}: Props) {
  const session = await guardPageModule("customers");
  const company = session.company;
const { id } = await params;
  const query = await searchParams;

  const customer = await db.customer.findFirst({
    where: {
      id,
      companyId: company.id,
    },
  });

  if (!customer) notFound();

  const groupColorMap = await getCustomerGroupColorMap(company.id);
  const customerGroupName = normalizeGroupName(customer.group);
  const customerGroupColor = groupColorMap[customerGroupName] ?? null;

  const { summary, ledger, openSales, recentSales, recentInvoices } =
    await getCustomerDetailLedgerData(company.id, customer.id);

  const statusBadge = getCustomerStatusBadge(customer.status);
  const showCreatedBanner = query.created === "1";
  const showUpdatedBanner = query.updated === "1";

  return (
    <AppShell>
      <div className="space-y-5">
        {showCreatedBanner ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Müşteri başarıyla oluşturuldu.
            </div>
          </div>
        ) : null}

        {showUpdatedBanner ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] font-bold text-blue-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Müşteri bilgileri güncellendi.
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/customers"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-lg font-black text-white">
                  {getInitials(customer.name) || "M"}
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        statusBadge.className,
                      ].join(" ")}
                    >
                      {statusBadge.label}
                    </span>

                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        getGroupBadge(customerGroupName, customerGroupColor),
                      ].join(" ")}
                    >
                      {customerGroupName}
                    </span>
                  </div>

                  <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                    {customer.name}
                  </h1>

                  <p className="mt-1 text-[13px] font-medium text-slate-500">
                    Kayıt tarihi: {formatDate(customer.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/customers/${customer.id}/edit`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[13px] font-black text-white transition hover:opacity-95"
              >
                <Edit3 size={16} />
                Düzenle
              </Link>

              <a
                href={buildSingleCustomerExportHref(customer.id)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-[13px] font-black text-[#24345f] transition hover:bg-slate-50"
              >
                <Download size={16} />
                CSV İndir
              </a>

              <Link
                href={`/sales/new?customerId=${customer.id}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-[13px] font-black text-[#24345f] transition hover:bg-slate-50"
              >
                <ShoppingCart size={16} />
                Satış Oluştur
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Cari Hareketler
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500">
                    Satış, tahsilat ve fatura hareketlerinin dökümü
                  </p>
                </div>
              </div>

              <CustomerLedgerTable entries={ledger} />
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[16px] font-black text-[#0f1f4d]">
                İletişim Bilgileri
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Telefon"
                  value={customer.phone || "Belirtilmedi"}
                  icon={<Phone size={18} />}
                />
                <InfoCard
                  label="E-posta"
                  value={customer.email || "Belirtilmedi"}
                  icon={<Mail size={18} />}
                />
                <InfoCard
                  label="Müşteri Grubu"
                  value={customerGroupName}
                  icon={<Users size={18} />}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[16px] font-black text-[#0f1f4d]">
                Vergi Bilgileri
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Vergi No / TCKN"
                  value={customer.taxNo || "Belirtilmedi"}
                  icon={<Building2 size={18} />}
                />
                <InfoCard
                  label="Vergi Dairesi"
                  value={customer.taxOffice || "Belirtilmedi"}
                  icon={<ReceiptText size={18} />}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <FileText size={16} />
                  <p className="text-[11px] font-black uppercase tracking-wide">
                    Vergi Levhası
                  </p>
                </div>

                {hasCustomerTaxCertificate(customer) ? (
                  <div className="space-y-3">
                    <p className="text-[14px] font-semibold text-[#24345f]">
                      {customer.taxCertificateFileName || "Vergi levhası dosyası"}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <a
                        href={customer.taxCertificateUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:opacity-95"
                      >
                        <ExternalLink size={14} />
                        Vergi Levhasını Görüntüle
                      </a>

                      <a
                        href={customer.taxCertificateUrl!}
                        download={customer.taxCertificateFileName || undefined}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50"
                      >
                        <Download size={14} />
                        İndir
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-[14px] font-semibold text-slate-500">
                    Vergi levhası eklenmemiş.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[16px] font-black text-[#0f1f4d]">
                Adres
              </h2>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <MapPin size={16} />
                  <p className="text-[11px] font-black uppercase tracking-wide">
                    Adres
                  </p>
                </div>
                <p className="text-[14px] font-semibold leading-6 text-[#24345f]">
                  {customer.address || "Adres bilgisi girilmemiş."}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[16px] font-black text-[#0f1f4d]">
                Son İşlemler
              </h2>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-[12px] font-black text-slate-500">
                    Son Satışlar
                  </p>

                  {recentSales.length > 0 ? (
                    <div className="space-y-2">
                      {recentSales.map((sale) => (
                        <Link
                          key={sale.id}
                          href={`/sales/${sale.id}`}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3 transition hover:border-blue-100 hover:bg-blue-50/40"
                        >
                          <div>
                            <p className="text-[12px] font-black text-[#0f1f4d]">
                              {sale.saleNo}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                              {formatDate(sale.createdAt)}
                            </p>
                          </div>
                          <p className="text-[12px] font-black text-[#0f1f4d]">
                            {formatCustomerMoney(sale.total)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] font-medium text-slate-500">
                      Bu müşteriye ait satış kaydı yok.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-[12px] font-black text-slate-500">
                    Son Faturalar
                  </p>

                  {recentInvoices.length > 0 ? (
                    <div className="space-y-2">
                      {recentInvoices.map((invoice) => (
                        <Link
                          key={invoice.id}
                          href={`/invoices/${invoice.id}`}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3 transition hover:border-blue-100 hover:bg-blue-50/40"
                        >
                          <div>
                            <p className="text-[12px] font-black text-[#0f1f4d]">
                              {invoice.invoiceNo}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                              {formatDate(invoice.createdAt)}
                            </p>
                          </div>
                          <p className="text-[12px] font-black text-[#0f1f4d]">
                            {formatCustomerMoney(invoice.total)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] font-medium text-slate-500">
                      Bu müşteriye ait fatura kaydı yok.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Cari Durum
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500">
                    Güncel bakiye özeti
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Kalan Bakiye
                </p>
                <p
                  className={[
                    "mt-2 text-[24px] font-black tracking-[-0.03em]",
                    summary.balanceStatus.amountClass,
                  ].join(" ")}
                >
                  {formatCustomerMoney(Math.abs(summary.currentBalance))}
                </p>
                <p className="mt-1 text-[12px] font-bold text-slate-500">
                  {summary.balanceStatus.subLabel}
                </p>
              </div>

              <div className="space-y-2">
                <SummaryLine
                  label="Toplam Borç"
                  value={formatCustomerMoney(summary.totalDebt)}
                  valueClass="text-rose-500"
                  icon={<ArrowUpRight size={15} />}
                />
                <SummaryLine
                  label="Toplam Tahsilat"
                  value={formatCustomerMoney(summary.totalCollected)}
                  valueClass="text-emerald-600"
                  icon={<ArrowDownLeft size={15} />}
                />
                <SummaryLine
                  label="Son Tahsilat"
                  value={
                    summary.lastCollectionDate
                      ? formatDate(summary.lastCollectionDate)
                      : "Henüz yok"
                  }
                  icon={<CalendarClock size={15} />}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <Wallet size={18} className="text-orange-500" />
                <h3 className="text-[15px] font-black text-[#0f1f4d]">
                  Tahsilat
                </h3>
              </div>

              <CustomerCollectPanel openSales={openSales} />
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-3 text-[15px] font-black text-[#0f1f4d]">
                Hızlı İşlemler
              </h3>

              <div className="space-y-2">
                <Link
                  href={`/customers/${customer.id}/edit`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-[12px] font-black text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <User size={16} />
                  Bilgileri Güncelle
                </Link>

                <Link
                  href={`/invoices/new?customerId=${customer.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-[12px] font-black text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <ReceiptText size={16} />
                  Fatura Oluştur
                </Link>

                <Link
                  href={`/invoices/e-invoice?customerId=${customer.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-[12px] font-black text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <ReceiptText size={16} />
                  e-Fatura Oluştur
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
