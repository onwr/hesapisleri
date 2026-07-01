import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Send,
  ShoppingCart,
  User,
  Wallet,
} from "lucide-react";
import { InvoiceDetailActions } from "@/components/invoices/invoice-detail-actions";
import { InvoiceEDocumentPanel } from "@/components/invoices/invoice-e-document-panel";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";

import { InvoicePrintOnLoad } from "@/components/invoices/invoice-print-on-load";
import { PrintInvoiceButton } from "@/components/invoices/print-invoice-button";
import {
  buildInvoiceDetailView,
  getInvoiceEditHref,
} from "@/lib/invoice-detail-utils";
import { formatMoney } from "@/lib/invoice-form-utils";
import {
  getInvoiceDetailForPage,
} from "@/lib/invoice-service";
import {
  getPaymentClass,
  getPaymentText,
} from "@/lib/invoices-page-utils";
import { db } from "@/lib/prisma";
import { getEDocumentIntegrationSummary } from "@/lib/e-document/e-document-integration-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
};

export default async function InvoiceDetailPage({ params, searchParams }: Props) {
  const session = await guardPageModule("invoices");
  const company = session.company;
const { id } = await params;
  const query = await searchParams;
  const shouldPrint = query.print === "1";

  const invoice = await db.invoice.findFirst({
    where: {
      id,
      companyId: company.id,
    },
    include: {
      customer: true,
      company: true,
      sale: true,
      items: {
        orderBy: { lineIndex: "asc" },
      },
    },
  });

  if (!invoice) notFound();

  const [detail, eDocument, documentSubmission] = await Promise.all([
    getInvoiceDetailForPage(company.id, id),
    getEDocumentIntegrationSummary(company.id),
    db.invoiceDocumentSubmission.findFirst({
      where: { companyId: company.id, invoiceId: id },
    }),
  ]);

  if (!detail) notFound();

  const view = buildInvoiceDetailView(
    {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      type: invoice.type,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      total: Number(invoice.total),
      subtotal: Number(invoice.subtotal),
      totalDiscount: Number(invoice.totalDiscount),
      taxableAmount: Number(invoice.taxableAmount),
      totalVat: Number(invoice.totalVat),
      financialSnapshotStatus: invoice.financialSnapshotStatus,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      gibStatus: invoice.gibStatus,
      gibMessage: invoice.gibMessage,
      pdfUrl: invoice.pdfUrl,
      saleId: invoice.saleId,
      customer: invoice.customer
        ? {
            id: invoice.customer.id,
            name: invoice.customer.name,
            phone: invoice.customer.phone,
            email: invoice.customer.email,
          }
        : null,
      company: {
        name: invoice.company.name,
        taxNo: invoice.company.taxNo,
        address: invoice.company.address,
      },
    },
    { dbItems: invoice.items }
  );

  const editHref = getInvoiceEditHref({
    id: invoice.id,
    status: invoice.status,
    type: invoice.type,
  });

  const canConvert =
    invoice.type === "NORMAL" && invoice.status !== "CANCELLED";

  return (
    <AppShell>
      <TenantPageSync />
      <InvoicePrintOnLoad enabled={shouldPrint} />

      <div className="space-y-5 print:space-y-4">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] print:border-none print:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/invoices"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50 print:hidden"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <p className="text-[12px] font-black uppercase tracking-wide text-slate-400">
                  {view.documentLabel}
                </p>
                <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  {invoice.invoiceNo}
                </h1>
                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  {view.typeLabel} · {view.statusLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <PrintInvoiceButton />
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-violet-600 px-4 text-[12px] font-black text-white"
              >
                PDF Aç
              </a>
              <Link
                href={editHref}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
              >
                Düzenle
              </Link>
              {canConvert ? (
                <Link
                  href={`/invoices/e-invoice?convertFrom=${invoice.id}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[12px] font-black text-blue-600"
                >
                  <Send size={14} />
                  e-Fatura&apos;ya Dönüştür
                </Link>
              ) : null}
              <InvoiceDetailActions
                invoiceId={detail.id}
                invoiceNo={detail.invoiceNo}
                total={detail.total}
                paidAmount={detail.paidAmount}
                remainingAmount={detail.remainingAmount}
                canCollect={detail.canCollect}
                canCancel={detail.canCancel}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            icon={<User size={18} />}
            title="Müşteri"
            value={invoice.customer?.name ?? "Müşteri seçilmedi"}
            subtitle={invoice.customer?.phone ?? invoice.customer?.email ?? "-"}
          />
          <InfoCard
            icon={<CalendarDays size={18} />}
            title="Tarihler"
            value={`${view.formattedIssueDate} · Vade ${view.formattedDueDate}`}
            subtitle={`Oluşturulma: ${view.formattedIssueDate}`}
          />
          <InfoCard
            icon={<Wallet size={18} />}
            title="Tahsil Edilen"
            value={formatMoney(detail.paidAmount)}
            subtitle={`Toplam ${formatMoney(detail.total)}`}
            badgeClass="bg-emerald-50 text-emerald-700"
          />
          <InfoCard
            icon={<Wallet size={18} />}
            title="Kalan / Durum"
            value={formatMoney(detail.remainingAmount)}
            subtitle={getPaymentText(invoice.paymentStatus)}
            badgeClass={getPaymentClass(invoice.paymentStatus)}
          />
        </section>

        {invoice.status !== "CANCELLED" ? (
          <InvoiceEDocumentPanel
            invoiceId={invoice.id}
            customerTaxNo={invoice.customer?.taxNo}
            integrationConnected={
              eDocument.provider === "TRENDYOL_EFATURAM" &&
              eDocument.status === "CONNECTED"
            }
            previewEnabled={eDocument.hasCredentials}
            submitEnabled={
              eDocument.provider === "TRENDYOL_EFATURAM" &&
              eDocument.status === "CONNECTED"
            }
            providerLabel={eDocument.providerLabel}
            submission={
              documentSubmission
                ? {
                    status: documentSubmission.status,
                    documentType: documentSubmission.documentType,
                    providerInvoiceUuid: documentSubmission.providerInvoiceUuid,
                    providerInvoiceId: documentSubmission.providerInvoiceId,
                    providerStatus: documentSubmission.providerStatus,
                    gibStatus: documentSubmission.gibStatus,
                    targetAlias: documentSubmission.targetAlias,
                    errorDetail: documentSubmission.errorDetail,
                    lastQueriedAt:
                      documentSubmission.lastQueriedAt?.toISOString() ?? null,
                  }
                : null
            }
          />
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)] print:border print:shadow-none">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText size={18} />
              </div>
              <div>
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  Fatura Kalemleri
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  {view.items.length > 0
                    ? `${view.items.length} kalem`
                    : "Kalem detayı kayıtta bulunmuyor"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                  <th className="px-4 py-3">Ürün / Hizmet</th>
                  <th className="px-4 py-3 text-center">Adet</th>
                  <th className="px-4 py-3 text-right">Birim Fiyat</th>
                  <th className="px-4 py-3 text-center">KDV</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.items.length > 0 ? (
                  view.items.map((item) => (
                    <tr key={item.id} className="text-[12px] font-semibold text-[#24345f]">
                      <td className="px-4 py-3 font-extrabold text-[#0f1f4d]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-center">%{item.vatRate}</td>
                      <td className="px-4 py-3 text-right font-black">
                        {formatMoney(item.lineGrossAmount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[13px] font-medium text-slate-500"
                    >
                      Bu faturada kalem detayı kayıtlı değil. Genel toplam:{" "}
                      {formatMoney(Number(invoice.total))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-100 p-4">
            <div className="w-full max-w-xs space-y-2">
              <SummaryLine label="Ara Toplam" value={view.formattedSubtotal} />
              <SummaryLine label="İndirim" value={view.formattedDiscount} />
              <SummaryLine label="KDV" value={view.formattedVat} />
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-[14px] font-black text-[#0f1f4d]">
                  Genel Toplam
                </span>
                <span className="text-[22px] font-black text-[#0f1f4d]">
                  {view.formattedTotal}
                </span>
              </div>
            </div>
          </div>
        </section>

        {invoice.sale ? (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 print:hidden">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[14px] font-black text-[#0f1f4d]">
                  Bağlı satış kaydı
                </p>
                <p className="mt-1 text-[12px] font-semibold text-emerald-700">
                  {invoice.sale.saleNo} numaralı satış ile ilişkilendirilmiş.
                  Tahsilat bu faturadan alındığında satış ödeme durumu da
                  senkron güncellenir.
                </p>
              </div>
              <Link
                href={`/sales/${invoice.sale.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white"
              >
                <ShoppingCart size={14} />
                Satış Detayına Git
              </Link>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] print:hidden">
          <h2 className="text-[16px] font-black text-[#0f1f4d]">Tahsilat Hareketleri</h2>

          {detail.collections.length > 0 ? (
            <div className="mt-4 space-y-3">
              {detail.collections.map((collection) => (
                <div
                  key={collection.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-[13px] font-black text-[#0f1f4d]">
                      {collection.title}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {collection.accountName} ·{" "}
                      {new Intl.DateTimeFormat("tr-TR").format(collection.date)}
                    </p>
                    {collection.note ? (
                      <p className="mt-1 text-[11px] text-slate-500">{collection.note}</p>
                    ) : null}
                  </div>
                  <p className="text-[14px] font-black text-emerald-600">
                    +{formatMoney(collection.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[13px] font-medium text-slate-500">
              Bu fatura için henüz tahsilat hareketi kaydedilmemiş.
            </p>
          )}
        </section>

        {view.displayMessage ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:hidden">
            <p className="text-[12px] font-black uppercase tracking-wide text-slate-400">
              Sistem Notu
            </p>
            <p className="mt-2 text-[13px] font-medium text-slate-600">
              {view.displayMessage}
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
  badgeClass,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p
        className={[
          "mt-2 text-[14px] font-black text-[#0f1f4d]",
          badgeClass ? "inline-block rounded-md px-2 py-1 text-[12px]" : "",
          badgeClass ?? "",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}
