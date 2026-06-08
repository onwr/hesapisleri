import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Download,
  Edit3,
  Eye,
  MoreVertical,
  Package,
  Truck,
  Warehouse,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  StocksTablePagination,
  StocksTableToolbar,
} from "@/components/stocks/stocks-table-controls";
import { StocksSidebarWidgets } from "@/components/stocks/stocks-sidebar-widgets";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { db } from "@/lib/prisma";
import { StocksPageActions } from "@/components/stocks/stocks-page-actions";
import { TransferCancelButton } from "@/components/stocks/transfer-cancel-button";
import { getStockFormOptions, getStocksPageData } from "@/lib/stocks-page-data";
import {
  getTransferStatusClass,
  getTransferStatusLabel,
} from "@/lib/warehouse-utils";
import {
  buildStocksQuery,
  formatMovementQuantityForDisplay,
  formatStockDateTime,
  formatStockMoney,
  getCategoryBadge,
  getMovementClass,
  getMovementText,
  normalizeDateRange,
  parseDateParam,
  parsePage,
  parseSearchQuery,
  parseStockTab,
} from "@/lib/stocks-page-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type StocksPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

const statIconMap = {
  package: Package,
  boxes: Boxes,
  warehouse: Warehouse,
  alert: AlertTriangle,
  alertRose: AlertTriangle,
};

const colorClassMap = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-500",
  rose: "bg-rose-50 text-rose-500",
};

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const params = await searchParams;
  const token = await getAuthToken();

  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const now = new Date();
  const activeTab = parseStockTab(params.tab);
  const currentPage = parsePage(params.page);
  const searchQuery = parseSearchQuery(params.q);
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? defaultFrom,
    parseDateParam(params.to) ?? defaultTo
  );

  const [pageData, formOptions] = await Promise.all([
    getStocksPageData(company.id, {
      tab: activeTab,
      page: currentPage,
      from,
      to,
      q: searchQuery,
    }),
    getStockFormOptions(company.id),
  ]);

  const {
    productRows,
    movementRows,
    transferRows,
    warehouseRows,
    statCards,
    actionCards,
    distribution,
    categoryTotals,
    recentMovements,
    totalStock,
    totalRecords,
    totalPages,
    currentPage: page,
    exportHref,
    movementMode,
    transferMode,
    warehouseMode,
  } = pageData;

  const hasFilters =
    Boolean(searchQuery) ||
    activeTab !== "all" ||
    parseDateParam(params.from) !== null ||
    parseDateParam(params.to) !== null;

  return (
    <AppShell>
      <div className="space-y-5">
        <StocksPageActions
          actionCards={actionCards}
          products={formOptions.products}
          warehouses={formOptions.warehouses}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <Link
                key={stat.title}
                href={buildStocksQuery({ tab: stat.tab, from, to, q: searchQuery })}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold text-[#24345f]/80">
                      {stat.title}
                    </p>

                    <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={22} strokeWidth={2.4} />
                  </div>
                </div>

                <p className="mt-3 text-[11px] font-semibold text-slate-500">
                  {stat.subtitle}
                </p>
              </Link>
            );
          })}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <StocksTableToolbar
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
            />

            <div className="overflow-x-auto">
              {transferMode ? (
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-2 py-2.5">Transfer No</th>
                      <th className="px-2 py-2.5">Ürün</th>
                      <th className="px-2 py-2.5">Çıkış Deposu</th>
                      <th className="px-2 py-2.5">Giriş Deposu</th>
                      <th className="px-2 py-2.5 text-right">Miktar</th>
                      <th className="px-2 py-2.5">Durum</th>
                      <th className="px-2 py-2.5">Tarih</th>
                      <th className="px-2 py-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transferRows.map((transfer) => (
                      <tr
                        key={transfer.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-2 py-2.5 font-black text-[#0f1f4d]">
                          {transfer.transferNo}
                        </td>
                        <td className="max-w-[160px] truncate px-2 py-2.5 font-extrabold">
                          {transfer.productName}
                        </td>
                        <td className="px-2 py-2.5">{transfer.fromWarehouseName}</td>
                        <td className="px-2 py-2.5">{transfer.toWarehouseName}</td>
                        <td className="px-2 py-2.5 text-right font-black text-violet-600">
                          {transfer.quantity}
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block rounded-md px-2 py-1 text-[10px] font-black",
                              getTransferStatusClass(transfer.status),
                            ].join(" ")}
                          >
                            {getTransferStatusLabel(transfer.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-600">
                          {formatStockDateTime(transfer.createdAt)}
                        </td>
                        <td className="px-2 py-2.5">
                          {transfer.canCancel ? (
                            <TransferCancelButton
                              transferId={transfer.id}
                              transferNo={transfer.transferNo}
                            />
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {transferRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center">
                          <EmptyState
                            hasFilters={hasFilters}
                            activeTab={activeTab}
                            from={from}
                            to={to}
                            transferMode
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              ) : warehouseMode ? (
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-2 py-2.5">Depo</th>
                      <th className="px-2 py-2.5">Kod</th>
                      <th className="px-2 py-2.5">Durum</th>
                      <th className="px-2 py-2.5">Ürün Çeşidi</th>
                      <th className="px-2 py-2.5">Toplam Stok</th>
                      <th className="px-2 py-2.5 text-right">Stok Değeri</th>
                      <th className="px-2 py-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {warehouseRows.map((warehouse) => (
                      <tr
                        key={warehouse.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="px-2 py-2.5">
                          <div className="font-extrabold text-[#0f1f4d]">
                            {warehouse.name}
                            {warehouse.isDefault ? (
                              <span className="ml-2 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                                Varsayılan
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">{warehouse.code || "—"}</td>
                        <td className="px-2 py-2.5">
                          {warehouse.status === "ACTIVE" ? "Aktif" : "Pasif"}
                        </td>
                        <td className="px-2 py-2.5">{warehouse.productCount}</td>
                        <td className="px-2 py-2.5 font-black">
                          {warehouse.totalStock} adet
                        </td>
                        <td className="px-2 py-2.5 text-right font-black">
                          {formatStockMoney(warehouse.totalValue)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Link
                            href={warehouse.detailHref}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] hover:bg-slate-50"
                          >
                            Detay
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {warehouseRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center">
                          <EmptyState
                            hasFilters={hasFilters}
                            activeTab={activeTab}
                            from={from}
                            to={to}
                            warehouseMode
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              ) : movementMode ? (
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-2 py-2.5">Ürün</th>
                      <th className="px-2 py-2.5">Kategori</th>
                      <th className="px-2 py-2.5">Depo</th>
                      <th className="px-2 py-2.5">Hareket</th>
                      <th className="px-2 py-2.5 text-right">Miktar</th>
                      <th className="px-2 py-2.5">Not</th>
                      <th className="px-2 py-2.5">Tarih</th>
                      <th className="w-[72px] px-2 py-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {movementRows.map((movement) => (
                      <tr
                        key={movement.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="max-w-[160px] truncate px-2 py-2.5 font-extrabold text-[#0f1f4d]">
                          {movement.productName}
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              getCategoryBadge(movement.categoryName),
                            ].join(" ")}
                          >
                            {movement.categoryName}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-[11px] text-slate-600">
                          {movement.warehouseName || "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              getMovementClass(movement.type),
                            ].join(" ")}
                          >
                            {getMovementText(movement.type)}
                          </span>
                        </td>
                        <td
                          className={[
                            "whitespace-nowrap px-2 py-2.5 text-right font-black",
                            movement.quantity > 0
                              ? "text-emerald-600"
                              : movement.quantity < 0
                                ? "text-rose-500"
                                : "text-slate-500",
                          ].join(" ")}
                        >
                          {formatMovementQuantityForDisplay(
                            movement.type,
                            movement.quantity
                          )}
                        </td>
                        <td className="max-w-[140px] truncate px-2 py-2.5 text-[11px] text-slate-500">
                          {movement.note || "-"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-600">
                          {formatStockDateTime(movement.createdAt)}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="mx-auto grid w-[62px] grid-cols-2 gap-1">
                            <Link
                              href={movement.detailHref}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Detay"
                            >
                              <Eye size={13} />
                            </Link>
                            <Link
                              href={movement.detailHref}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Düzenle"
                            >
                              <Edit3 size={13} />
                            </Link>
                            <a
                              href={exportHref}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                              title="Listeyi indir"
                            >
                              <Download size={13} />
                            </a>
                            <Link
                              href={movement.detailHref}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                              title="Diğer"
                            >
                              <MoreVertical size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {movementRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center">
                          <EmptyState
                            hasFilters={hasFilters}
                            activeTab={activeTab}
                            from={from}
                            to={to}
                            movementMode
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-2 py-2.5">Ürün Adı</th>
                      <th className="px-2 py-2.5">Stok Kodu</th>
                      <th className="px-2 py-2.5">Kategori</th>
                      <th className="px-2 py-2.5">Mevcut Stok</th>
                      <th className="px-2 py-2.5">Kritik Seviye</th>
                      <th className="px-2 py-2.5 text-right">Stok Değeri</th>
                      <th className="px-2 py-2.5">Durum</th>
                      <th className="w-[72px] px-2 py-2.5 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {productRows.map((product) => (
                      <tr
                        key={product.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="max-w-[200px] px-2 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Package size={16} />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-extrabold text-[#0f1f4d]">
                                {product.name}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                                {product.description || "Açıklama yok"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-2 py-2.5 font-bold text-[#24345f]">
                          {product.sku}
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              getCategoryBadge(product.categoryName),
                            ].join(" ")}
                          >
                            {product.categoryName}
                          </span>
                        </td>

                        <td className="px-2 py-2.5">
                          <p
                            className={[
                              "font-black tracking-[-0.01em]",
                              product.stockTextClass,
                            ].join(" ")}
                          >
                            {product.stock} adet
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">
                          {product.criticalLevel} adet
                        </td>

                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-black text-[#0f1f4d]">
                          {formatStockMoney(product.stockValue)}
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              product.statusBadgeClass,
                            ].join(" ")}
                          >
                            {product.statusLabel}
                          </span>
                        </td>

                        <td className="px-2 py-2.5">
                          <div className="mx-auto flex w-[72px] items-center justify-center gap-1.5">
                            <Link
                              href={product.detailHref}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Detay"
                            >
                              <Eye size={14} />
                            </Link>
                            <Link
                              href={product.stockMovementHref}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-orange-100 bg-orange-50 text-orange-600 transition hover:bg-orange-100"
                              title="Stok Hareketi"
                            >
                              <Boxes size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {productRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center">
                          <EmptyState
                            hasFilters={hasFilters}
                            activeTab={activeTab}
                            from={from}
                            to={to}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              )}
            </div>

            <StocksTablePagination
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              totalPages={totalPages}
              currentPage={page}
              totalRecords={totalRecords}
              movementMode={movementMode}
            />
          </section>

          <aside className="space-y-4">
            <StocksSidebarWidgets
              distribution={distribution}
              categoryTotals={categoryTotals}
              recentMovements={recentMovements}
              totalStock={totalStock}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyState({
  hasFilters,
  activeTab,
  from,
  to,
  movementMode = false,
  transferMode = false,
  warehouseMode = false,
}: {
  hasFilters: boolean;
  activeTab: ReturnType<typeof parseStockTab>;
  from: Date;
  to: Date;
  movementMode?: boolean;
  transferMode?: boolean;
  warehouseMode?: boolean;
}) {
  if (transferMode || activeTab === "transfers") {
    return (
      <div className="mx-auto max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
          <Truck size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          {hasFilters ? "Transfer bulunamadı" : "Henüz transfer yok"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Üstteki Depo Transferi kartından yeni transfer başlatabilirsiniz.
        </p>
      </div>
    );
  }

  if (warehouseMode || activeTab === "warehouses") {
    return (
      <div className="mx-auto max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <Warehouse size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          {hasFilters ? "Depo bulunamadı" : "Henüz depo yok"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Depo yönetimi sayfasından yeni depo ekleyebilirsiniz.
        </p>

        <Link
          href="/stocks/warehouses"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
        >
          Depoları Yönet
        </Link>
      </div>
    );
  }

  const title = movementMode
    ? hasFilters
      ? "Bu filtrede hareket bulunamadı"
      : activeTab === "count"
        ? "Henüz sayım kaydı yok"
        : "Henüz stok hareketi yok"
    : hasFilters
      ? "Bu filtrede kayıt bulunamadı"
      : "Henüz ürün yok";

  const description = movementMode
    ? hasFilters
      ? "Arama veya tarih filtrenizi değiştirerek tekrar deneyebilirsiniz."
      : activeTab === "count"
        ? "Ürün detayından stok sayımı yaparak kayıt oluşturabilirsiniz."
        : "Ürün detayından stok girişi/çıkışı yaparak hareket oluşturabilirsiniz."
    : hasFilters
      ? "Arama, tarih veya sekme filtrenizi değiştirerek tekrar deneyebilirsiniz."
      : "İlk ürününüzü ekleyerek stok takibine başlayabilirsiniz.";

  return (
    <div className="mx-auto max-w-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
        <Package size={28} />
      </div>

      <p className="mt-4 text-lg font-black text-[#0f1f4d]">{title}</p>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

      <Link
        href={
          hasFilters
            ? buildStocksQuery({ tab: activeTab, from, to })
            : movementMode
              ? buildStocksQuery({ tab: "all" })
              : "/products/new"
        }
        className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
      >
        {hasFilters
          ? "Filtreyi Temizle"
          : movementMode
            ? "Ürün Listesine Git"
            : "İlk Ürünü Ekle"}
      </Link>
    </div>
  );
}
