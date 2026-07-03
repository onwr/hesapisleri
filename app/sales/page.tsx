import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  ReceiptText,
  RefreshCcw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { db } from "@/lib/prisma";

import { SalesRowActions } from "@/components/sales/sales-row-actions";
import {
  SalesTablePagination,
  SalesTableToolbar,
} from "@/components/sales/sales-table-controls";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { formatShortDateTime } from "@/lib/sales-page-data";
import { getCachedSalesPageData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  normalizeDateRange,
  parseDateParam,
  parsePage,
  parseSalesTab,
  toSalesRowActionData,
} from "@/lib/sales-page-utils";
import { formatMoney } from "@/lib/format-utils";
import { AiPageTriggerButton } from "@/components/ai-assistant/ai-page-trigger-button";
import {
  CompactActionCard,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

type SalesPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
};

function getPaymentBadge(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-orange-100 text-orange-700";
  return "bg-rose-100 text-rose-700";
}

function getPaymentText(status: string) {
  if (status === "PAID") return "Tahsil Edildi";
  if (status === "PARTIAL") return "Kısmi Tahsilat";
  return "Tahsil Edilmedi";
}

function getStatusBadge(status?: string | null) {
  if (status === "CANCELLED" || status === "ERROR") {
    return "bg-rose-100 text-rose-700";
  }

  if (status === "DRAFT") return "bg-amber-100 text-amber-700";

  return "bg-emerald-100 text-emerald-700";
}

function getStatusText(status?: string | null) {
  if (status === "CANCELLED") return "İptal";
  if (status === "ERROR") return "Hata";
  if (status === "DRAFT") return "Taslak Teklif";
  if (status === "SENT" || status === "APPROVED" || status === "COMPLETED") {
    return "Onaylandı";
  }

  return "Onaylandı";
}

const actionCards = [
  {
    title: "Yeni Satış",
    description: "Hemen satış oluştur",
    href: "/sales/new",
    iconName: "shopping-cart" as const,
    color: "emerald" as const,
  },
  {
    title: "Fatura Kes",
    description: "Yeni fatura oluştur",
    href: "/invoices/e-invoice",
    iconName: "file-text" as const,
    color: "violet" as const,
  },
  {
    title: "Tahsilat Al",
    description: "Müşteriden ödeme al",
    href: "/cash-bank/collections",
    iconName: "wallet" as const,
    color: "sky" as const,
  },
  {
    title: "İade / İptal",
    description: "İade veya iptal işlemi",
    href: "/sales?tab=returns",
    iconName: "refresh-ccw" as const,
    color: "orange" as const,
  },
  {
    title: "Teklif Oluştur",
    description: "Müşteriye teklif ver",
    href: "/sales/quotes/new",
    iconName: "receipt-text" as const,
    color: "rose" as const,
  },
];

const statIconMap = {
  trending: TrendingUp,
  check: CheckCircle2,
  wallet: Wallet,
  file: FileText,
  calendar: CalendarDays,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-500",
  violet: "bg-violet-50 text-violet-600",
  sky: "bg-sky-50 text-sky-500",
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const session = await guardPageModule("sales");
  const company = session.company;
  const params = await searchParams;
const now = new Date();
  const activeTab = parseSalesTab(params.tab);
  const currentPage = parsePage(params.page);
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? defaultFrom,
    parseDateParam(params.to) ?? defaultTo
  );

  const { statCards, rows, totalRecords, totalPages, currentPage: page, exportHref } =
    await getCachedSalesPageData({
      companyId: company.id,
      tab: activeTab,
      page: currentPage,
      from,
      to,
    });

  const hasNoSalesEver =
    rows.length === 0
      ? (await db.sale.count({ where: { companyId: company.id } })) === 0
      : false;

  return (
    <AppShell>
      <TenantPageSync />
      <div className="space-y-5">
        <div className="flex justify-end">
          <AiPageTriggerButton moduleKey="sales" />
        </div>

        <CompactActionCardGrid columns="5">
          {actionCards.map((card) => (
            <CompactActionCard
              key={card.title}
              title={card.title}
              description={card.description}
              href={card.href}
              iconName={card.iconName}
              color={card.color}
            />
          ))}
        </CompactActionCardGrid>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={21} strokeWidth={2.3} />
                  </div>
                </div>

                <p className="mt-4 text-[12px] font-bold text-[#24345f]/80">
                  {stat.title}
                </p>

                <p className="mt-1 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                  {stat.value}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500">
                    {stat.subtitle}
                  </span>

                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-1 text-[10px] font-black leading-none",
                      stat.positive
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600",
                    ].join(" ")}
                  >
                    {stat.positive ? "↑" : "↓"} {stat.change}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <SalesTableToolbar
            activeTab={activeTab}
            from={from}
            to={to}
            exportHref={exportHref}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Belge No</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Tür</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="px-4 py-3">Tahsilat Durumu</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-center">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {formatShortDateTime(row.createdAt)}
                    </td>

                    <td className="px-4 py-3 font-bold text-[#24345f]">
                      {row.documentNo}
                    </td>

                    <td className="px-4 py-3">{row.customerName}</td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-[10px] font-black",
                          row.typeBadgeClass,
                        ].join(" ")}
                      >
                        {row.typeLabel}
                      </span>
                    </td>

                    <td
                      className={[
                        "px-4 py-3 text-right font-black",
                        row.amount < 0 ? "text-rose-600" : "text-[#0f1f4d]",
                      ].join(" ")}
                    >
                      {formatMoney(row.amount)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-[10px] font-black",
                          getPaymentBadge(row.paymentStatus),
                        ].join(" ")}
                      >
                        {getPaymentText(row.paymentStatus)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-[10px] font-black",
                          getStatusBadge(row.saleStatus),
                        ].join(" ")}
                      >
                        {getStatusText(row.saleStatus)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <SalesRowActions row={toSalesRowActionData(row)} />
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                          <ShoppingCart size={28} />
                        </div>

                        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                          {hasNoSalesEver
                            ? "Henüz satış yok"
                            : "Bu filtrede kayıt bulunamadı"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {hasNoSalesEver
                            ? "POS veya satış ekranından ilk işleminizi gerçekleştirin."
                            : "Seçili sekme veya tarih aralığında gösterilecek kayıt yok. Filtreyi genişletebilir veya yeni satış oluşturabilirsiniz."}
                        </p>

                        <Link
                          href={hasNoSalesEver ? "/pos" : "/sales/new"}
                          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
                        >
                          {hasNoSalesEver ? "İlk Satışını Yap" : "Yeni Satış Oluştur"}
                        </Link>
                        {hasNoSalesEver ? (
                          <Link
                            href="/onboarding"
                            className="mt-3 block text-sm font-semibold text-blue-600 hover:underline"
                          >
                            Kurulum rehberine dön
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <SalesTablePagination
            activeTab={activeTab}
            from={from}
            to={to}
            totalPages={totalPages}
            currentPage={page}
            totalRecords={totalRecords}
          />
        </section>
      </div>
    </AppShell>
  );
}
