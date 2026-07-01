import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  Package,
  Printer,
  ReceiptText,
  Send,
  ShoppingCart,
  Sparkles,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { PrintSaleButton } from "@/components/sales/print-sale-button";
import { QuoteCancelButton } from "@/components/sales/quote-cancel-button";
import { SaleCancelButton } from "@/components/sales/sale-cancel-button";
import { QuoteConvertPanel } from "@/components/sales/quote-convert-panel";
import { SaleCollectPayment } from "@/components/sales/sale-collect-payment";
import { SalePrintOnLoad } from "@/components/sales/sale-print-on-load";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";

import { getCachedSaleDetailData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { formatMoney, formatDateTimeDisplay } from "@/lib/format-utils";
import { getSaleRemainingAmount } from "@/lib/sale-payment-utils";
import { getPosPaymentMethodLabel } from "@/lib/pos-checkout-utils";
import { canCancelSales, canUpdateSales } from "@/lib/sale-permission-utils";
import {
  validateSaleCancelEligibility,
  validateSaleEditEligibility,
} from "@/lib/sale-mutation-policy";

type Props = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    print?: string;
    convert?: string;
  }>;
};

function getPaymentStatusText(status: string) {
  if (status === "PAID") return "Ödendi";
  if (status === "PARTIAL") return "Kısmi Ödendi";
  if (status === "FAILED") return "Başarısız";
  if (status === "UNPAID") return "Ödenmedi";
  return status;
}

function getPaymentStatusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-orange-100 text-orange-700";
  if (status === "FAILED") return "bg-rose-100 text-rose-700";
  if (status === "UNPAID") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function getCustomerBalanceText(balance: number) {
  if (balance > 0) return "Borçlu";
  if (balance < 0) return "Alacaklı";
  return "Borç Yok";
}

function getCustomerBalanceClass(balance: number) {
  if (balance > 0) return "bg-rose-50 text-rose-600";
  if (balance < 0) return "bg-emerald-50 text-emerald-600";
  return "bg-slate-100 text-slate-600";
}

export default async function SaleDetailPage({ params, searchParams }: Props) {
  const session = await guardPageModule("sales");
  const company = session.company;
const { id } = await params;
  const query = await searchParams;
  const shouldPrint = query.print === "1";
  const shouldOpenConvert = query.convert === "1";

  const detail = await getCachedSaleDetailData({
    companyId: company.id,
    saleId: id,
  });

  if (!detail) notFound();

  const { sale, stockMovements, accountTransactions } = detail;

  const isQuote = sale.status === "DRAFT";
  const isCancelled = sale.status === "CANCELLED";
  const paidAmount = Number(sale.paidAmount);
  const saleTotal = Number(sale.total);
  const remainingAmount = getSaleRemainingAmount(saleTotal, paidAmount);
  const canCollectRemaining =
    !isQuote &&
    !isCancelled &&
    sale.status !== "REFUNDED" &&
    remainingAmount > 0;

  const canEditSale =
    !isQuote &&
    canUpdateSales(session.effectiveRole, session.companyUser.isOwner) &&
    validateSaleEditEligibility(sale).ok;

  const canCancelSale =
    !isQuote &&
    canCancelSales(session.effectiveRole, session.companyUser.isOwner) &&
    validateSaleCancelEligibility(sale).ok;

  const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
  const customerBalance = Number(sale.customer?.balance ?? 0);

  return (
    <AppShell>
      <TenantPageSync />
      <SalePrintOnLoad enabled={shouldPrint} />

      <div className="no-print space-y-5">
        <section
          className={[
            "overflow-hidden rounded-2xl border shadow-[0_14px_34px_rgba(15,23,42,0.06)]",
            isQuote
              ? "border-violet-100 bg-linear-to-br from-violet-600 via-blue-600 to-[#0f1f4d]"
              : isCancelled
                ? "border-rose-100 bg-linear-to-br from-rose-600 via-slate-800 to-[#0f1f4d]"
                : "border-blue-100 bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700",
          ].join(" ")}
        >
          <div className="relative p-5 text-white md:p-6">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10" />
            <div className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-white/10" />

            <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <Link
                  href={isQuote ? "/sales?tab=offers" : "/sales"}
                  className="mb-4 inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-[12px] font-black text-white/90 backdrop-blur transition hover:bg-white/15"
                >
                  <ArrowLeft size={15} strokeWidth={2.6} />
                  {isQuote ? "Tekliflere dön" : "Satışlara dön"}
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black backdrop-blur">
                    <Sparkles size={14} strokeWidth={2.5} />
                    {isQuote
                      ? "Taslak Teklif"
                      : isCancelled
                        ? "İptal Edilmiş Kayıt"
                        : "Satış Kaydı"}
                  </span>

                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black backdrop-blur">
                    {sale.saleNo}
                  </span>
                </div>

                <h1 className="mt-4 text-[30px] font-black leading-tight tracking-tighter md:text-[38px]">
                  {isQuote ? "Teklif Detayı" : "Satış Detayı"}
                </h1>

                <p className="mt-3 max-w-3xl text-[13px] font-medium leading-6 text-white/85 md:text-sm">
                  {isQuote
                    ? "Bu kayıt satışa dönüştürülmeden stok düşmez, cari bakiyeye işlenmez ve fatura kesilemez."
                    : isCancelled
                      ? "Bu satış iptal edilmiş. Aktif satış toplamlarına, stok/cari hesaplarına ve raporlara dahil edilmemelidir."
                      : "Satış kalemleri, tahsilat durumu, fatura bağlantısı, stok ve kasa hareketlerini buradan takip edebilirsiniz."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <HeroBadge
                    label="Satış Tarihi"
                    value={formatDateTimeDisplay(sale.saleDate ?? sale.createdAt)}
                    icon={<CalendarDays size={15} />}
                  />

                  <HeroBadge
                    label="Oluşturma"
                    value={formatDateTimeDisplay(sale.createdAt)}
                    icon={<CalendarDays size={15} />}
                  />

                  {sale.warehouse ? (
                    <HeroBadge
                      label="Depo"
                      value={sale.warehouse.name}
                      icon={<Package size={15} />}
                    />
                  ) : null}

                  <HeroBadge
                    label="Kalem"
                    value={`${sale.items.length} ürün / ${totalQuantity} adet`}
                    icon={<ShoppingCart size={15} />}
                  />

                  <HeroBadge
                    label="Toplam"
                    value={formatMoney(saleTotal)}
                    icon={<Wallet size={15} />}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
                <PrintSaleButton />

                {isQuote ? (
                  <>
                    <QuoteConvertPanel
                      saleId={sale.id}
                      saleNo={sale.saleNo}
                      total={saleTotal}
                      defaultOpen={shouldOpenConvert}
                    />

                    <Link
                      href={`/sales/quotes/${sale.id}/edit`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-[12px] font-black text-white backdrop-blur transition hover:bg-white/15"
                    >
                      <Edit3 size={16} strokeWidth={2.5} />
                      Teklifi Düzenle
                    </Link>

                    <QuoteCancelButton
                      saleId={sale.id}
                      saleNo={sale.saleNo}
                      variant="destructive"
                    />
                  </>
                ) : sale.invoice ? (
                  <>
                    <div className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-[12px] font-black text-emerald-700">
                      <CheckCircle2 size={17} strokeWidth={2.5} />
                      Fatura Kesildi
                    </div>

                    <Link
                      href={`/invoices/${sale.invoice.id}`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d] transition hover:bg-blue-50"
                    >
                      <FileText size={17} strokeWidth={2.5} />
                      Faturayı Gör
                    </Link>
                  </>
                ) : !isCancelled ? (
                  <>
                    {canEditSale ? (
                      <Link
                        href={`/sales/${sale.id}/edit`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-[12px] font-black text-white backdrop-blur transition hover:bg-white/15"
                      >
                        <Edit3 size={16} strokeWidth={2.5} />
                        Satışı Düzenle
                      </Link>
                    ) : null}

                    {canCancelSale ? (
                      <SaleCancelButton
                        saleId={sale.id}
                        saleNo={sale.saleNo}
                        variant="destructive"
                      />
                    ) : null}

                    <Link
                      href={`/invoices/e-invoice?saleId=${sale.id}`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[12px] font-black text-blue-600 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50"
                    >
                      <Send size={17} strokeWidth={2.5} />
                      e-Fatura / e-Arşiv Kes
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={isQuote ? "Teklif No" : "Satış No"}
            value={sale.saleNo}
            subtitle={isQuote ? "Taslak teklif numarası" : "Satış takip numarası"}
            icon={<ReceiptText size={22} strokeWidth={2.4} />}
            color={isQuote ? "violet" : "blue"}
          />

          <MetricCard
            title="Genel Toplam"
            value={formatMoney(saleTotal)}
            subtitle={`${sale.items.length} kalem · ${totalQuantity} adet`}
            icon={<Wallet size={22} strokeWidth={2.4} />}
            color="emerald"
          />

          {isQuote ? (
            <>
              <MetricCard
                title="Stok Etkisi"
                value="Beklemede"
                subtitle="Teklif aşamasında stok düşmez"
                icon={<Package size={22} strokeWidth={2.4} />}
                color="orange"
              />

              <MetricCard
                title="Cari Etkisi"
                value="İşlenmedi"
                subtitle="Satışa dönüşünce hesaplanır"
                icon={<User size={22} strokeWidth={2.4} />}
                color="blue"
              />
            </>
          ) : (
            <>
              <MetricCard
                title="Ödeme Durumu"
                value={getPaymentStatusText(sale.paymentStatus)}
                subtitle={`Alınan: ${formatMoney(paidAmount)}`}
                icon={<CreditCard size={22} strokeWidth={2.4} />}
                color={
                  sale.paymentStatus === "PAID"
                    ? "emerald"
                    : sale.paymentStatus === "PARTIAL"
                      ? "orange"
                      : "slate"
                }
              />

              <MetricCard
                title="Fatura Durumu"
                value={sale.invoice ? "Faturalandı" : "Bekliyor"}
                subtitle={sale.invoice?.invoiceNo || "Fatura oluşturulmadı"}
                icon={<FileText size={22} strokeWidth={2.4} />}
                color={sale.invoice ? "emerald" : "orange"}
              />
            </>
          )}
        </section>

        {isQuote ? (
          <section className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-blue-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                  <Sparkles size={21} strokeWidth={2.5} />
                </div>

                <div>
                  <p className="text-[15px] font-black text-[#0f1f4d]">
                    Bu kayıt taslak tekliftir
                  </p>
                  <p className="mt-1 max-w-3xl text-[12px] font-medium leading-6 text-slate-600">
                    Teklif satışa dönüştürülmeden stok düşmez, müşteri cari
                    bakiyesi güncellenmez ve fatura kesilemez. Dönüşüm anında
                    stok kontrolü, tahsilat ve cari kuralları tek transaction
                    içinde uygulanır.
                  </p>
                </div>
              </div>

                    <QuoteConvertPanel
                      saleId={sale.id}
                      saleNo={sale.saleNo}
                      total={saleTotal}
                      defaultOpen={false}
                    />
            </div>
          </section>
        ) : null}

        {isCancelled ? (
          <section className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm">
                <XCircle size={21} strokeWidth={2.5} />
              </div>

              <div>
                <p className="text-[15px] font-black text-[#0f1f4d]">
                  Bu satış iptal edilmiş
                </p>
                <p className="mt-1 text-[12px] font-medium leading-6 text-rose-700">
                  {sale.cancelReason
                    ? `Neden: ${sale.cancelReason}`
                    : "İptal nedeni kaydedilmemiş."}
                  {sale.cancelledAt
                    ? ` · ${formatDateTimeDisplay(sale.cancelledAt)}`
                    : ""}
                  {sale.cancelledByUser?.name
                    ? ` · ${sale.cancelledByUser.name}`
                    : ""}
                </p>
                {sale.cancelNote ? (
                  <p className="mt-2 text-[12px] font-medium text-rose-600">
                    {sale.cancelNote}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {canCollectRemaining ? (
          <section className="no-print">
            <SaleCollectPayment
              saleId={sale.id}
              saleNo={sale.saleNo}
              remainingAmount={remainingAmount}
            />
          </section>
        ) : null}

        {sale.invoice ? (
          <section className="no-print rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <CheckCircle2 size={21} strokeWidth={2.5} />
                </div>

                <div>
                  <p className="text-[15px] font-black text-[#0f1f4d]">
                    Bu satış faturalandırılmış
                  </p>
                  <p className="mt-1 text-[12px] font-medium leading-6 text-emerald-700">
                    {sale.invoice.invoiceNo} numaralı fatura bu satışa bağlı
                    olarak oluşturulmuş. Aynı satış için tekrar fatura kesilemez.
                  </p>
                </div>
              </div>

              <Link
                href={`/invoices/${sale.invoice.id}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white"
              >
                Faturayı Görüntüle
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <main className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <SectionHeader
                icon={<ShoppingCart size={21} strokeWidth={2.4} />}
                color="blue"
                title={isQuote ? "Teklif Kalemleri" : "Satış Kalemleri"}
                description={
                  isQuote
                    ? "Teklife dahil edilen ürün ve hizmet satırları"
                    : "Satışa dahil edilen ürün ve hizmet satırları"
                }
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-4 py-3">Ürün / Hizmet</th>
                      <th className="px-4 py-3">Adet</th>
                      <th className="px-4 py-3">Birim Fiyat</th>
                      <th className="px-4 py-3">KDV</th>
                      <th className="px-4 py-3 text-right">Toplam</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {sale.items.map((item) => (
                      <tr
                        key={item.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                              <Package size={18} strokeWidth={2.4} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-black text-[#0f1f4d]">
                                {item.name}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                                {item.product?.sku ||
                                  item.product?.barcode ||
                                  "Ürün kodu yok"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 font-black text-[#0f1f4d]">
                          {item.quantity}
                        </td>

                        <td className="px-4 py-4">
                          {formatMoney(Number(item.unitPrice))}
                        </td>

                        <td className="px-4 py-4">%{item.vatRate}</td>

                        <td className="px-4 py-4 text-right font-black text-[#0f1f4d]">
                          {formatMoney(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <SectionHeader
                  icon={<User size={21} strokeWidth={2.4} />}
                  color="violet"
                  title="Müşteri Bilgisi"
                  description={
                    isQuote
                      ? "Teklifin bağlı olduğu müşteri"
                      : "Satışın bağlı olduğu müşteri"
                  }
                />

                <div className="p-4">
                  {sale.customer ? (
                    <div className="space-y-3">
                      <InfoLine label="Müşteri" value={sale.customer.name} />
                      <InfoLine
                        label="Telefon"
                        value={sale.customer.phone || "Telefon yok"}
                      />
                      <InfoLine
                        label="E-posta"
                        value={sale.customer.email || "E-posta yok"}
                      />

                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="text-[12px] font-bold text-slate-500">
                          Cari Bakiye
                        </span>

                        <div className="text-right">
                          <p className="text-[13px] font-black text-[#0f1f4d]">
                            {formatMoney(Math.abs(customerBalance))}
                          </p>
                          <span
                            className={[
                              "mt-1 inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                              getCustomerBalanceClass(customerBalance),
                            ].join(" ")}
                          >
                            {getCustomerBalanceText(customerBalance)}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/customers/${sale.customer.id}`}
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[12px] font-black text-blue-600 transition hover:bg-blue-50"
                      >
                        Müşteri Detayına Git
                      </Link>
                    </div>
                  ) : (
                    <EmptyState
                      title="Perakende / hızlı satış"
                      description="Bu kayıt herhangi bir müşteriye bağlanmadan oluşturulmuş."
                      icon={<User size={24} />}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <SectionHeader
                  icon={<FileText size={21} strokeWidth={2.4} />}
                  color="orange"
                  title="Belge ve Fatura"
                  description="Satış / teklif belgelendirme durumu"
                />

                <div className="space-y-3 p-4">
                  <InfoLine
                    label={isQuote ? "Teklif No" : "Satış No"}
                    value={sale.saleNo}
                  />

                  <InfoLine
                    label="Oluşturma Tarihi"
                    value={formatDateTimeDisplay(sale.createdAt)}
                  />

                  <InfoLine
                    label="Belge Tipi"
                    value={isQuote ? "Taslak Teklif" : "Satış Kaydı"}
                  />

                  {sale.warehouse ? (
                    <InfoLine label="Depo" value={sale.warehouse.name} />
                  ) : null}

                  {!isQuote && sale.revisionNumber > 0 ? (
                    <InfoLine label="Revizyon" value={`#${sale.revisionNumber}`} />
                  ) : null}

                  {!isQuote ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                      <span className="text-[12px] font-bold text-slate-500">
                        Fatura Durumu
                      </span>
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-[10px] font-black",
                          sale.invoice
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-orange-100 text-orange-700",
                        ].join(" ")}
                      >
                        {sale.invoice ? "Faturalandı" : "Bekliyor"}
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                      <p className="text-[12px] font-black text-[#0f1f4d]">
                        Teklif satışa dönüştürülmeden fatura kesilemez.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <ActivityCard
                title="Stok Hareketleri"
                description={
                  isQuote
                    ? "Teklif aşamasında stok hareketi oluşmaz"
                    : "Bu satışa bağlı oluşan stok kayıtları"
                }
                icon={<Package size={21} strokeWidth={2.4} />}
                color="blue"
                emptyTitle={
                  isQuote ? "Teklif aşamasında stok düşülmedi" : "Stok hareketi yok"
                }
                emptyDescription={
                  isQuote
                    ? "Satışa dönüştürme anında stok kontrol edilir ve stok düşülür."
                    : "Bu satış stok düşen bir ürün içermiyor olabilir."
                }
                items={stockMovements.map((movement) => ({
                  id: movement.id,
                  title: movement.product.name,
                  description: [
                    movement.warehouse?.name
                      ? `Depo: ${movement.warehouse.name}`
                      : null,
                    movement.note || "Stok hareketi",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  date: formatDateTimeDisplay(movement.createdAt),
                  value: `${movement.quantity > 0 ? "+" : ""}${movement.quantity}`,
                  positive: movement.quantity > 0,
                }))}
              />

              <ActivityCard
                title="Kasa / Banka Hareketleri"
                description={
                  isQuote
                    ? "Teklif aşamasında tahsilat oluşmaz"
                    : "Bu satışa bağlı tahsilat kayıtları"
                }
                icon={<Banknote size={21} strokeWidth={2.4} />}
                color="emerald"
                emptyTitle={
                  isQuote ? "Teklif aşamasında kasa hareketi yok" : "Kasa hareketi yok"
                }
                emptyDescription={
                  isQuote
                    ? "Tahsilat ve kasa hareketleri satışa dönüştürme sonrası oluşur."
                    : "Bu satış ödenmemiş olabilir veya eski satış kaydı olabilir."
                }
                items={accountTransactions.map((transaction) => ({
                  id: transaction.id,
                  title: transaction.title,
                  description: `${transaction.account.name} · ${
                    transaction.note || "Tahsilat hareketi"
                  }`,
                  date: formatDateTimeDisplay(transaction.createdAt),
                  value: formatMoney(Number(transaction.amount)),
                  positive: Number(transaction.amount) >= 0,
                }))}
              />
            </section>
          </main>

          <aside className="space-y-5">
            <div className="sticky top-24 space-y-5">
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-black text-[#0f1f4d]">
                        {isQuote ? "Teklif Özeti" : "Satış Özeti"}
                      </h2>
                      <p className="mt-1 text-[12px] font-medium text-slate-500">
                        Tutar ve ödeme bilgileri
                      </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <ReceiptText size={22} strokeWidth={2.4} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <SummaryRow
                      label="Ara Toplam"
                      value={formatMoney(Number(sale.subtotal))}
                    />
                    <SummaryRow
                      label="KDV"
                      value={formatMoney(Number(sale.vatTotal))}
                    />
                    <SummaryRow
                      label="İndirim"
                      value={formatMoney(Number(sale.discount))}
                    />

                    <div className="h-px bg-slate-200" />

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-black text-[#0f1f4d]">
                        Genel Toplam
                      </span>
                      <span className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                        {formatMoney(saleTotal)}
                      </span>
                    </div>

                    {!isQuote ? (
                      <>
                        <div className="h-px bg-slate-200" />
                        <SummaryRow
                          label="Alınan Tutar"
                          value={formatMoney(paidAmount)}
                        />
                        <SummaryRow
                          label="Kalan Tahsilat"
                          value={formatMoney(remainingAmount)}
                        />
                      </>
                    ) : null}
                  </div>

                  {!isQuote ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                        Ödeme Durumu
                      </p>

                      <span
                        className={[
                          "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                          getPaymentStatusClass(sale.paymentStatus),
                        ].join(" ")}
                      >
                        {getPaymentStatusText(sale.paymentStatus)}
                      </span>

                      {sale.payments.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {sale.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600"
                            >
                              <span className="font-black text-[#0f1f4d]">
                                {getPosPaymentMethodLabel(payment.paymentMethod)}
                              </span>
                              <span className="text-slate-400"> · </span>
                              <span>{payment.account.name}</span>
                              <span className="text-slate-400"> · </span>
                              <span className="font-black text-emerald-700">
                                {formatMoney(Number(payment.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-[13px] font-black text-[#0f1f4d]">
                        Taslak teklif kaydı
                      </p>
                      <p className="mt-1 text-[11px] font-medium leading-5 text-violet-700">
                        Satışa dönüştürülmeden stok, cari ve kasa etkisi oluşmaz.
                      </p>
                    </div>
                  )}

                  {sale.note ? (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-[12px] font-black text-[#0f1f4d]">
                        Not
                      </p>
                      <p className="mt-2 text-[12px] font-medium leading-5 text-blue-700">
                        {sale.note}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    {isQuote ? (
                      <>
                    <QuoteConvertPanel
                      saleId={sale.id}
                      saleNo={sale.saleNo}
                      total={saleTotal}
                      defaultOpen={false}
                    />

                        <Link
                          href={`/sales/quotes/${sale.id}/edit`}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-[#24345f] transition hover:bg-slate-50"
                        >
                          <Edit3 size={16} strokeWidth={2.5} />
                          Teklifi Düzenle
                        </Link>
                      </>
                    ) : sale.invoice ? (
                      <Link
                        href={`/invoices/${sale.invoice.id}`}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-emerald-500 to-green-600 text-[12px] font-black text-white shadow-lg shadow-emerald-100"
                      >
                        <FileText size={16} strokeWidth={2.5} />
                        Faturayı Gör
                      </Link>
                    ) : !isCancelled ? (
                      <>
                        {canEditSale ? (
                          <Link
                            href={`/sales/${sale.id}/edit`}
                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-[#24345f] transition hover:bg-slate-50"
                          >
                            <Edit3 size={16} strokeWidth={2.5} />
                            Satışı Düzenle
                          </Link>
                        ) : null}

                        <Link
                          href={`/invoices/e-invoice?saleId=${sale.id}`}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-[12px] font-black text-white shadow-lg shadow-blue-100"
                        >
                          <Send size={16} strokeWidth={2.5} />
                          e-Fatura / e-Arşiv Kes
                        </Link>

                        {canCancelSale ? (
                          <SaleCancelButton saleId={sale.id} saleNo={sale.saleNo} />
                        ) : null}
                      </>
                    ) : null}

                    <div className="flex h-11 items-center justify-center">
                      <PrintSaleButton />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                  Fiş Önizleme
                </h3>

                <SaleReceipt company={company} sale={sale} />
              </section>

              <section className="grid gap-3">
                <ImpactCard
                  icon={<Package size={20} strokeWidth={2.4} />}
                  title="Stok Etkisi"
                  description={
                    isQuote
                      ? "Teklif aşamasında stok düşülmedi. Satışa dönüştürme anında stok kontrol edilir."
                      : stockMovements.length > 0
                        ? `${stockMovements.length} stok hareketi bulundu.`
                        : "Bu satışa bağlı stok hareketi bulunamadı."
                  }
                  color="blue"
                />

                <ImpactCard
                  icon={<Banknote size={20} strokeWidth={2.4} />}
                  title={isQuote ? "Cari Etkisi" : "Kasa Etkisi"}
                  description={
                    isQuote
                      ? "Teklif aşamasında müşteri cari bakiyesi güncellenmedi."
                      : accountTransactions.length > 0
                        ? `${accountTransactions.length} kasa/banka hareketi bulundu.`
                        : paidAmount > 0
                          ? "Tahsilat işaretlenmiş ancak kasa hareketi bulunamadı."
                          : "Bu satış için ödeme bekliyor görünüyor."
                  }
                  color="emerald"
                />
              </section>
            </div>
          </aside>
        </section>
      </div>

      <div className="print-only">
        <SaleReceipt company={company} sale={sale} />
      </div>
    </AppShell>
  );
}

type HeroBadgeProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

function HeroBadge({ label, value, icon }: HeroBadgeProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
        {icon}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-white/60">
          {label}
        </p>
        <p className="text-[12px] font-black text-white">{value}</p>
      </div>
    </div>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  color: "blue" | "emerald" | "orange" | "violet" | "slate";
};

function MetricCard({ title, value, subtitle, icon, color }: MetricCardProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold text-[#24345f]/80">
            {title}
          </p>
          <p className="mt-3 truncate text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
            {value}
          </p>
        </div>

        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            colorMap[color],
          ].join(" ")}
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 truncate text-[11px] font-semibold text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

type SectionHeaderProps = {
  icon: ReactNode;
  color: "blue" | "violet" | "orange" | "emerald";
  title: string;
  description: string;
};

function SectionHeader({ icon, color, title, description }: SectionHeaderProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-500",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="border-b border-slate-100 p-4">
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            colorMap[color],
          ].join(" ")}
        >
          {icon}
        </div>

        <div>
          <h2 className="text-[16px] font-black text-[#0f1f4d]">{title}</h2>
          <p className="text-[12px] font-medium text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
      <span className="text-[12px] font-bold text-slate-500">{label}</span>
      <span className="max-w-[190px] truncate text-right text-[12px] font-black text-[#0f1f4d]">
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}

function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        {icon}
      </div>

      <p className="mt-4 text-[14px] font-black text-[#0f1f4d]">{title}</p>
      <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

type ActivityCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  color: "blue" | "emerald";
  emptyTitle: string;
  emptyDescription: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    value: string;
    positive: boolean;
  }>;
};

function ActivityCard({
  title,
  description,
  icon,
  color,
  emptyTitle,
  emptyDescription,
  items,
}: ActivityCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <SectionHeader
        icon={icon}
        color={color}
        title={title}
        description={description}
      />

      <div className="space-y-3 p-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                {item.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-slate-500">
                {item.description}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                {item.date}
              </p>
            </div>

            <span
              className={[
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-black",
                item.positive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700",
              ].join(" ")}
            >
              {item.value}
            </span>
          </div>
        ))}

        {items.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={icon}
          />
        ) : null}
      </div>
    </div>
  );
}

type ImpactCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  color: "blue" | "emerald";
};

function ImpactCard({ icon, title, description, color }: ImpactCardProps) {
  const colorMap = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={["rounded-2xl border p-4", colorMap[color]].join(" ")}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
        {icon}
      </div>

      <p className="mt-4 text-[13px] font-black text-[#0f1f4d]">{title}</p>
      <p className="mt-2 text-[11px] font-medium leading-5 opacity-80">
        {description}
      </p>
    </div>
  );
}

type SaleReceiptProps = {
  company: {
    name: string;
    phone: string | null;
  };
  sale: {
    saleNo: string;
    createdAt: Date;
    subtotal: unknown;
    vatTotal: unknown;
    discount: unknown;
    total: unknown;
    note: string | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: unknown;
      total: unknown;
    }>;
  };
  className?: string;
};

function SaleReceipt({ company, sale, className = "" }: SaleReceiptProps) {
  const discount = Number(sale.discount);

  return (
    <div
      className={[
        "print-area rounded-2xl border border-dashed border-slate-300 bg-white p-5 font-mono text-[12px]",
        className,
      ].join(" ")}
    >
      <div className="text-center">
        <p className="font-black text-[#0f1f4d]">{company.name}</p>
        {company.phone ? (
          <p className="mt-1 text-[11px] text-slate-500">{company.phone}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">{sale.saleNo}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {formatDateTimeDisplay(sale.createdAt)}
        </p>
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="space-y-2">
        {sale.items.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between gap-4">
              <span className="max-w-[160px] truncate">{item.name}</span>
              <span>{formatMoney(Number(item.total))}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {item.quantity} x {formatMoney(Number(item.unitPrice))}
            </p>
          </div>
        ))}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Ara Toplam</span>
          <span>{formatMoney(Number(sale.subtotal))}</span>
        </div>

        <div className="flex justify-between">
          <span>KDV</span>
          <span>{formatMoney(Number(sale.vatTotal))}</span>
        </div>

        {discount > 0 ? (
          <div className="flex justify-between">
            <span>İndirim</span>
            <span>-{formatMoney(discount)}</span>
          </div>
        ) : null}

        <div className="flex justify-between pt-1 font-black text-[#0f1f4d]">
          <span>TOPLAM</span>
          <span>{formatMoney(Number(sale.total))}</span>
        </div>
      </div>

      {sale.note ? (
        <>
          <div className="my-4 border-t border-dashed border-slate-300" />
          <p className="text-[11px] text-slate-500">{sale.note}</p>
        </>
      ) : null}

      <div className="my-4 border-t border-dashed border-slate-300" />

      <p className="text-center text-[11px] text-slate-500">Hesapişleri.com</p>
    </div>
  );
}