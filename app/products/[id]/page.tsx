import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Barcode,
  Boxes,
  CheckCircle2,
  Edit3,
  Hash,
  MapPin,
  Package,
  Percent,
  ReceiptText,
  ShoppingCart,
  Tags,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getProductDetailData } from "@/lib/product-detail-data";
import {
  formatProfitMargin,
  PRODUCT_UNIT_LABELS,
  type ProductUnitType,
} from "@/lib/product-form-utils";
import { db } from "@/lib/prisma";
import {
  formatProductMoney,
  getCategoryBadge,
  getProductStatusBadge,
  getStockMovementTypeLabel,
} from "@/lib/products-page-utils";
import {
  formatMovementQuantityDisplay,
  isMovementIncoming,
} from "@/lib/stock-movement-utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; stockUpdated?: string }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
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
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
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

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;

  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: { company: true },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const detail = await getProductDetailData(company.id, id);
  if (!detail) notFound();

  const {
    product,
    stockMovements,
    warehouseStocks,
    warehouseCount,
    recentSales,
    isCriticalStock,
    formatted,
  } = detail;

  const statusBadge = getProductStatusBadge(product.status);
  const unitLabel =
    PRODUCT_UNIT_LABELS[product.unitType as ProductUnitType] ?? "Adet";
  const showCreatedBanner = query.created === "1";
  const showUpdatedBanner = query.updated === "1";
  const showStockUpdatedBanner = query.stockUpdated === "1";

  return (
    <AppShell>
      <div className="space-y-5">
        {showCreatedBanner ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Ürün başarıyla oluşturuldu.
            </div>
          </div>
        ) : null}

        {showUpdatedBanner ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] font-bold text-blue-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Ürün bilgileri güncellendi.
            </div>
          </div>
        ) : null}

        {showStockUpdatedBanner ? (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-[13px] font-bold text-orange-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Stok hareketi başarıyla kaydedildi.
            </div>
          </div>
        ) : null}

        {isCriticalStock ? (
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-[13px] font-bold text-orange-700">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              Kritik stok uyarısı: Mevcut stok ({product.stock} {unitLabel}),
              minimum seviyenin ({product.minStock} {unitLabel}) altında veya
              eşit.
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/products"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div className="flex items-start gap-4">
                <ProductThumbnail
                  imageUrl={product.imageUrl}
                  alt={product.name}
                  size={96}
                  iconSize={32}
                  rounded="2xl"
                  className="border border-slate-200 bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-sm"
                />

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
                        getCategoryBadge(product.categoryName),
                      ].join(" ")}
                    >
                      {product.categoryName}
                    </span>
                  </div>

                  <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                    {product.name}
                  </h1>

                  <p className="mt-1 text-[13px] font-medium text-slate-500">
                    {product.sku ? `SKU: ${product.sku}` : "SKU belirtilmedi"}
                    {product.barcode
                      ? ` · Barkod: ${product.barcode}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/products/${product.id}/edit`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 px-5 text-[13px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95"
              >
                <Edit3 size={16} />
                Düzenle
              </Link>

              <Link
                href={`/products/${product.id}/stock`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <Boxes size={16} />
                Stok Hareketi
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h2 className="mb-4 text-[16px] font-black text-[#0f1f4d]">
                Ürün Bilgileri
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard
                  label="Kategori"
                  value={product.categoryName}
                  icon={<Tags size={18} />}
                />
                <InfoCard
                  label="SKU"
                  value={product.sku || "Belirtilmedi"}
                  icon={<Hash size={18} />}
                />
                <InfoCard
                  label="Barkod"
                  value={product.barcode || "Belirtilmedi"}
                  icon={<Barcode size={18} />}
                />
                <InfoCard
                  label="Birim Tipi"
                  value={unitLabel}
                  icon={<Package size={18} />}
                />
                <InfoCard
                  label="Raf / Depo"
                  value={product.warehouseLocation || "Belirtilmedi"}
                  icon={<Warehouse size={18} />}
                />
                <InfoCard
                  label="KDV Oranı"
                  value={`%${product.vatRate}`}
                  icon={<Percent size={18} />}
                />
              </div>

              {product.description ? (
                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Açıklama
                  </p>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-[#0f1f4d]">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </section>

            {warehouseStocks.length > 0 ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Depo Bazlı Stok Dağılımı
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      {warehouseCount > 0
                        ? `${warehouseCount} depoda stok var`
                        : "Depo stokları"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/products/${product.id}/stock`}
                      className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-[12px] font-black text-orange-600"
                    >
                      Stok Hareketi
                    </Link>
                    <Link
                      href="/stocks?tab=transfers"
                      className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[12px] font-black text-violet-600"
                    >
                      Transfer
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {warehouseStocks
                    .filter((entry) => entry.quantity > 0)
                    .map((entry) => (
                      <div
                        key={entry.warehouseId}
                        className="flex items-center justify-between px-4 py-3 text-[13px]"
                      >
                        <span className="font-bold text-[#0f1f4d]">
                          {entry.warehouseName}
                          {entry.isDefault ? " (Varsayılan)" : ""}
                        </span>
                        <span className="font-black text-emerald-600">
                          {entry.quantity} adet
                        </span>
                      </div>
                    ))}
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-[13px] font-black text-[#0f1f4d]">
                    <span>Toplam</span>
                    <span>{product.stock} adet</span>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Son Stok Hareketleri
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500">
                    Son 10 hareket
                  </p>
                </div>
                <Link
                  href={`/products/${product.id}/stock`}
                  className="text-[12px] font-black text-blue-600 hover:underline"
                >
                  Tümünü gör
                </Link>
              </div>

              {stockMovements.length === 0 ? (
                <div className="p-8 text-center text-[13px] font-medium text-slate-500">
                  Henüz stok hareketi yok.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Tarih</th>
                        <th className="px-4 py-3">Depo</th>
                        <th className="px-4 py-3">Tür</th>
                        <th className="px-4 py-3">Miktar</th>
                        <th className="px-4 py-3">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockMovements.map((movement) => {
                        const isIncoming = isMovementIncoming(
                          movement.type,
                          movement.quantity
                        );
                        const typeLabel = getStockMovementTypeLabel(
                          movement.type
                        );
                        const quantityLabel = formatMovementQuantityDisplay(
                          movement.type,
                          movement.quantity
                        );
                        const displayDate = movement.movementDate ?? movement.createdAt;

                        return (
                          <tr
                            key={movement.id}
                            className="border-b border-slate-50 text-[13px]"
                          >
                            <td className="px-4 py-3 font-medium text-slate-600">
                              {formatDate(displayDate)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {movement.warehouse?.name || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black",
                                  isIncoming
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700",
                                ].join(" ")}
                              >
                                {isIncoming ? (
                                  <ArrowDownLeft size={12} />
                                ) : (
                                  <ArrowUpRight size={12} />
                                )}
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-black text-[#0f1f4d]">
                              {quantityLabel}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-500">
                              {movement.note || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  Son Satışlar
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  Bu ürünün yer aldığı son 10 satış
                </p>
              </div>

              {recentSales.length === 0 ? (
                <div className="p-8 text-center text-[13px] font-medium text-slate-500">
                  Henüz satış kaydı yok.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Satış No</th>
                        <th className="px-4 py-3">Tarih</th>
                        <th className="px-4 py-3">Adet</th>
                        <th className="px-4 py-3">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map((sale) => (
                        <tr
                          key={`${sale.id}-${sale.quantity}`}
                          className="border-b border-slate-50 text-[13px]"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/sales/${sale.id}`}
                              className="font-black text-blue-600 hover:underline"
                            >
                              {sale.saleNo}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {formatDate(sale.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-black text-[#0f1f4d]">
                            {sale.quantity}
                          </td>
                          <td className="px-4 py-3 font-black text-[#0f1f4d]">
                            {formatProductMoney(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Ürün Görseli
                </p>
              </div>
              <div className="p-4">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ProductThumbnail
                      imageUrl={null}
                      alt={product.name}
                      size={120}
                      iconSize={48}
                      rounded="2xl"
                      className="border-0 bg-transparent"
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 bg-linear-to-br from-rose-500 to-pink-600 p-5 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/80">
                  Stok Durumu
                </p>
                <p className="mt-2 text-[32px] font-black leading-none">
                  {product.stock}{" "}
                  <span className="text-[16px] font-bold">{unitLabel}</span>
                </p>
                <p className="mt-2 text-[12px] font-medium text-white/80">
                  Min. seviye: {product.minStock} {unitLabel}
                </p>
              </div>

              <div className="space-y-3 p-4">
                <SummaryLine
                  label="Stok değeri"
                  value={formatted.stockValue}
                  icon={<TrendingUp size={15} />}
                />
                <SummaryLine
                  label="Alış fiyatı"
                  value={formatted.buyPrice}
                  icon={<ReceiptText size={15} />}
                />
                <SummaryLine
                  label="Satış fiyatı"
                  value={formatted.sellPrice}
                  icon={<ShoppingCart size={15} />}
                />
                <SummaryLine
                  label="Tahmini kâr"
                  value={formatted.profit}
                  valueClass="text-emerald-600"
                  icon={<TrendingUp size={15} />}
                />
                <SummaryLine
                  label="Kâr marjı"
                  value={formatProfitMargin(product.margin)}
                  valueClass="text-emerald-600"
                  icon={<Percent size={15} />}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                POS Önizleme
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <ProductThumbnail
                    imageUrl={product.imageUrl}
                    alt={product.name}
                    size={48}
                    iconSize={22}
                    rounded="xl"
                    className="border border-slate-200 bg-white shadow-sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-[#0f1f4d]">
                      {product.name}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {product.categoryName}
                    </p>
                    <p className="mt-3 text-[18px] font-black text-rose-600">
                      {formatted.sellPrice}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      Stok: {product.stock} {unitLabel}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {product.warehouseLocation ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-[#0f1f4d]">
                      Depo Konumu
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      {product.warehouseLocation}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
