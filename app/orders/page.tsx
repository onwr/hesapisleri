import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  PackageCheck,
  RefreshCcw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  CompactActionCard,
  type CompactActionIconName,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

import { MarketplaceLogo } from "@/components/orders/marketplace-logo";
import { OrdersRowActions } from "@/components/orders/orders-row-actions";
import {
  OrdersTablePagination,
  OrdersTableToolbar,
} from "@/components/orders/orders-table-controls";
import { OrdersSidebarWidgets } from "@/components/orders/orders-sidebar-widgets";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getMarketplaceName } from "@/lib/marketplace-logos";
import { getOrdersPageData } from "@/lib/orders-page-data";
import {
  buildOrdersQuery,
  formatOrderDateTime,
  formatOrderMoney,
  normalizeDateRange,
  ORDER_STATUS_CLASS,
  parseDateParam,
  parseOrderTab,
  parsePage,
  parseSearchQuery,
  parseSourceChannelFilter,
  parseOrderArchiveFilter,
  type OrderActionCard,
} from "@/lib/orders-page-utils";

type OrdersPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
    q?: string;
    channel?: string;
    archive?: string;
  }>;
};

const orderActionIconMap: Record<
  OrderActionCard["iconKey"],
  CompactActionIconName
> = {
  plus: "plus",
  refresh: "refresh-ccw",
  truck: "truck",
  spreadsheet: "upload",
  grid: "layout-grid",
  bag: "shopping-bag",
};

const statIconMap = {
  bag: ShoppingBag,
  refresh: RefreshCcw,
  check: CheckCircle2,
  truck: Truck,
  package: PackageCheck,
  alert: AlertCircle,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-500",
  blue: "bg-blue-50 text-blue-600",
  rose: "bg-rose-50 text-rose-500",
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await guardPageModule("orders");
  const company = session.company;
  const params = await searchParams;
const now = new Date();
  const activeTab = parseOrderTab(params.tab);
  const currentPage = parsePage(params.page);
  const searchQuery = parseSearchQuery(params.q);
  const sourceChannel = parseSourceChannelFilter(params.channel);
  const archiveFilter = parseOrderArchiveFilter(params.archive);
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? defaultFrom,
    parseDateParam(params.to) ?? defaultTo
  );

  const {
    rows,
    statCards,
    actionCards,
    channelBreakdown,
    integrationActivities,
    periodOrderCount,
    totalRecords,
    totalPages,
    currentPage: page,
    exportHref,
    integrationOrderCounts,
    integrationStatuses,
  } = await getOrdersPageData(company.id, {
    tab: activeTab,
    page: currentPage,
    from,
    to,
    q: searchQuery,
    channel: sourceChannel,
    archive: archiveFilter,
  });

  const hasFilters =
    Boolean(searchQuery) ||
    activeTab !== "all" ||
    parseDateParam(params.from) !== null ||
    parseDateParam(params.to) !== null ||
    Boolean(sourceChannel) ||
    archiveFilter !== "active";

  return (
    <AppShell>
      <TenantPageSync />
      <div className="space-y-5">
        <CompactActionCardGrid columns="5">
          {actionCards.map((card) => (
            <CompactActionCard
              key={card.title}
              title={card.title}
              description={card.description}
              href={card.href}
              iconName={orderActionIconMap[card.iconKey]}
              color={card.color}
            />
          ))}
        </CompactActionCardGrid>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <Link
                key={stat.title}
                href={buildOrdersQuery({ tab: stat.tab, from, to, q: searchQuery })}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold text-[#24345f]/80">
                      {stat.title}
                    </p>

                    <p className="mt-2 text-[22px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.count}
                    </p>

                    <p className="mt-1 text-[13px] font-black tracking-[-0.02em] text-[#0f1f4d]">
                      {formatOrderMoney(stat.amount)}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={18} strokeWidth={2.3} />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <OrdersTableToolbar
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              channel={sourceChannel}
              archive={archiveFilter}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                    <th className="px-2 py-2.5">Sipariş No</th>
                    <th className="px-2 py-2.5">Kanal</th>
                    <th className="px-2 py-2.5">Müşteri</th>
                    <th className="px-2 py-2.5">Ürün</th>
                    <th className="px-2 py-2.5 text-right">Tutar</th>
                    <th className="px-2 py-2.5">Durum</th>
                    <th className="px-2 py-2.5">Kargo</th>
                    <th className="px-2 py-2.5">Tarih</th>
                    <th className="w-[72px] px-2 py-2.5 text-center">İşlem</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((order) => (
                    <tr
                      key={order.id}
                      className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-2 py-2.5 font-extrabold text-blue-600">
                        <Link href={order.detailHref}>{order.orderNo}</Link>
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <MarketplaceLogo
                            channel={order.channel}
                            className="h-7 w-7"
                            iconSize={12}
                          />
                          <span className="hidden text-[10px] font-bold text-slate-500 lg:inline">
                            {getMarketplaceName(order.channel)}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-[160px] px-2 py-2.5">
                        <p className="truncate font-extrabold text-[#0f1f4d]">
                          {order.customerName}
                        </p>
                        {order.customerSubName ? (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                            {order.customerSubName}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5">
                        {order.itemCount} ürün
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-black text-[#0f1f4d]">
                        {formatOrderMoney(order.total)}
                      </td>

                      <td className="px-2 py-2.5">
                        <span
                          className={[
                            "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                            ORDER_STATUS_CLASS[order.status],
                          ].join(" ")}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="max-w-[120px] px-2 py-2.5">
                        <p className="truncate font-bold text-[#24345f]">
                          {order.cargo}
                        </p>
                        {order.cargoCode ? (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                            {order.cargoCode}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-600">
                        {formatOrderDateTime(order.createdAt)}
                      </td>

                      <td className="px-2 py-2.5">
                        <OrdersRowActions
                          orderId={order.id}
                          orderNo={order.orderNo}
                          orderStatus={order.orderStatus}
                          sourceChannel={order.channel}
                          detailHref={order.detailHref}
                          isArchived={order.isArchived}
                        />
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                            <ShoppingBag size={28} />
                          </div>

                          <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                            {hasFilters
                              ? "Bu filtrede sipariş bulunamadı"
                              : "Henüz sipariş yok"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {hasFilters
                              ? "Arama, tarih veya sekme filtrenizi değiştirerek tekrar deneyebilirsiniz."
                              : "Manuel sipariş oluşturabilir veya entegrasyon bağlayarak siparişlerinizi çekebilirsiniz."}
                          </p>

                          <Link
                            href={
                              hasFilters
                                ? buildOrdersQuery({ tab: activeTab, from, to })
                                : "/sales/new"
                            }
                            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                          >
                            {hasFilters ? "Filtreyi Temizle" : "İlk Siparişi Oluştur"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <OrdersTablePagination
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              channel={sourceChannel}
              archive={archiveFilter}
              totalPages={totalPages}
              currentPage={page}
              totalRecords={totalRecords}
            />
          </section>

          <aside className="space-y-4">
            <OrdersSidebarWidgets
              channelBreakdown={channelBreakdown}
              integrationActivities={integrationActivities}
              totalCount={periodOrderCount}
              integrationOrderCounts={integrationOrderCounts}
              integrationStatuses={integrationStatuses}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
