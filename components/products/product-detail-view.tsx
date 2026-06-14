"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Link2,
  Printer,
  ScanBarcode,
} from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import {
  getProductMarketplaceBadge,
  getProductPosVisibilityBadge,
  getProductStockBadge,
  MARKETPLACE_CHANNEL_LABELS,
  printProductBarcode,
} from "@/lib/product-ui-utils";
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

type DetailTabKey =
  | "general"
  | "stock"
  | "sales"
  | "marketplace"
  | "activity";

const TAB_LABELS: Record<DetailTabKey, string> = {
  general: "Genel Bilgiler",
  stock: "Stok Hareketleri",
  sales: "Satış Geçmişi",
  marketplace: "Pazaryeri Eşlemeleri",
  activity: "Aktivite",
};

export type ProductDetailViewProps = {
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    description: string | null;
    imageUrl: string | null;
    categoryName: string;
    status: string;
    stock: number;
    minStock: number;
    buyPrice: number;
    sellPrice: number;
    stockValue: number;
    vatRate: number;
    warehouseLocation: string | null;
    unitType: string;
    createdAt: string;
    updatedAt: string;
    isService: boolean;
  };
  formatted: {
    buyPrice: string;
    sellPrice: string;
    profit: string;
    stockValue: string;
    monthSalesTotal: string;
  };
  monthSalesQuantity: number;
  unitLabel: string;
  stockMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    note: string | null;
    movementDate: string | null;
    createdAt: string;
    warehouse: { name: string } | null;
  }>;
  recentSales: Array<{
    id: string;
    saleNo: string;
    createdAt: string;
    quantity: number;
    total: number;
  }>;
  channelMappings: Array<{
    id: string;
    channel: "TRENDYOL" | "HEPSIBURADA";
    merchantSku: string;
    barcode: string | null;
    externalProductId: string | null;
  }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function ProductDetailView({
  product,
  formatted,
  monthSalesQuantity,
  unitLabel,
  stockMovements,
  recentSales,
  channelMappings,
}: ProductDetailViewProps) {
  const [activeTab, setActiveTab] = useState<DetailTabKey>("general");

  const statusBadge = getProductStatusBadge(product.status);
  const stockBadge = getProductStockBadge({
    stock: product.stock,
    minStock: product.minStock,
    isService: product.isService,
  });
  const posBadge = getProductPosVisibilityBadge(product.status);
  const mappingBadge = getProductMarketplaceBadge(
    channelMappings.map((item) => item.channel)
  );

  return (
    <div className="space-y-4">
      <section className={PRODUCT_CARD_CLASS}>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ProductThumbnail
              imageUrl={product.imageUrl}
              alt={product.name}
              size={64}
              iconSize={24}
              rounded="xl"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                    statusBadge.className,
                  ].join(" ")}
                >
                  {statusBadge.label}
                </span>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                    stockBadge.className,
                  ].join(" ")}
                >
                  {stockBadge.label}
                </span>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                    posBadge.className,
                  ].join(" ")}
                >
                  <ScanBarcode size={11} />
                  {posBadge.label}
                </span>
                {mappingBadge ? (
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                      mappingBadge.className,
                    ].join(" ")}
                  >
                    {mappingBadge.label}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                {product.name}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                SKU: {product.sku || "Belirtilmedi"}
                {product.barcode ? ` · Barkod: ${product.barcode}` : ""}
              </p>
              <span
                className={[
                  "mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                  getCategoryBadge(product.categoryName),
                ].join(" ")}
              >
                {product.categoryName}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/products/${product.id}/edit`}
              className="inline-flex h-9 items-center rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white transition hover:bg-[#162a5c]"
            >
              Düzenle
            </Link>
            <Link
              href={`/products/${product.id}/stock`}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
            >
              Stok Hareketi
            </Link>
            <button
              type="button"
              onClick={() =>
                printProductBarcode({
                  name: product.name,
                  barcode: product.barcode,
                  sku: product.sku || "—",
                  sellPriceLabel: formatted.sellPrice,
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
            >
              <Printer size={14} />
              Barkod Yazdır
            </button>
            <Link
              href="/pos"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
            >
              POS&apos;ta Gör
            </Link>
          </div>
        </div>
      </section>

      <section className={PRODUCT_CARD_CLASS}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <InfoLine
              label="Mevcut Stok"
              value={
                product.isService
                  ? "Hizmet ürünü"
                  : `${product.stock} ${unitLabel}`
              }
            />
            <InfoLine
              label="Kritik Stok"
              value={
                product.isService ? "—" : `${product.minStock} ${unitLabel}`
              }
            />
            <InfoLine label="Satış Fiyatı" value={formatted.sellPrice} />
            <InfoLine label="Alış Fiyatı" value={formatted.buyPrice} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex rounded-md px-2 py-1 text-[10px] font-black ring-1 ring-inset",
                stockBadge.className,
              ].join(" ")}
            >
              {stockBadge.label}
            </span>
            <Link
              href="/stocks"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
            >
              <ExternalLink size={14} />
              Stok Merkezi&apos;nde Gör
            </Link>
          </div>
        </div>
      </section>

      <section className={PRODUCT_CARD_CLASS}>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-3">
          {(Object.keys(TAB_LABELS) as DetailTabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-xl px-3 py-2 text-[12px] font-black transition",
                activeTab === tab
                  ? "bg-[#0f1f4d] text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="p-3">
          {activeTab === "general" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <InfoLine label="Kategori" value={product.categoryName} />
              <InfoLine label="Birim" value={unitLabel} />
              <InfoLine label="KDV" value={`%${product.vatRate}`} />
              <InfoLine
                label="Bu Ay Satış"
                value={`${formatted.monthSalesTotal} (${monthSalesQuantity} adet)`}
              />
              <InfoLine label="Stok Değeri" value={formatted.stockValue} />
              <InfoLine label="Tahmini Kâr" value={formatted.profit} />
              <InfoLine
                label="Depo / Raf"
                value={product.warehouseLocation || "Belirtilmedi"}
              />
              {product.description ? (
                <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Açıklama
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#0f1f4d]">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "stock" ? (
            stockMovements.length === 0 ? (
              <EmptyPanel message="Henüz stok hareketi yok." />
            ) : (
              <div className="space-y-2">
                {stockMovements.map((movement) => {
                  const isIncoming = isMovementIncoming(
                    movement.type,
                    movement.quantity
                  );
                  const displayDate = movement.movementDate ?? movement.createdAt;

                  return (
                    <div
                      key={movement.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-black text-[#0f1f4d]">
                          {getStockMovementTypeLabel(movement.type)}
                        </p>
                        <p className="text-[12px] font-medium text-slate-500">
                          {formatDate(displayDate)}
                          {movement.warehouse?.name
                            ? ` · ${movement.warehouse.name}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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
                          {formatMovementQuantityDisplay(
                            movement.type,
                            movement.quantity
                          )}
                        </span>
                        <span className="text-[12px] font-medium text-slate-500">
                          {movement.note || "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {activeTab === "sales" ? (
            recentSales.length === 0 ? (
              <EmptyPanel message="Henüz satış kaydı yok." />
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale) => (
                  <div
                    key={`${sale.id}-${sale.quantity}`}
                    className="flex flex-col gap-1 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/sales/${sale.id}`}
                      className="text-sm font-black text-blue-600 hover:underline"
                    >
                      {sale.saleNo}
                    </Link>
                    <div className="flex items-center gap-4 text-sm font-semibold text-slate-600">
                      <span>{formatDate(sale.createdAt)}</span>
                      <span>{sale.quantity} adet</span>
                      <span className="font-black text-[#0f1f4d]">
                        {formatProductMoney(sale.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === "marketplace" ? (
            channelMappings.length === 0 ? (
              <EmptyPanel message="Pazaryeri eşlemesi bulunmuyor.">
                <Link
                  href="/products/channel-mapping"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-black text-violet-600 hover:underline"
                >
                  <Link2 size={14} />
                  SKU Eşlemeleri
                </Link>
              </EmptyPanel>
            ) : (
              <div className="space-y-2">
                {channelMappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="rounded-2xl border border-slate-100 px-4 py-3"
                  >
                    <p className="text-sm font-black text-[#0f1f4d]">
                      {MARKETPLACE_CHANNEL_LABELS[mapping.channel]}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      Merchant SKU: {mapping.merchantSku}
                      {mapping.barcode ? ` · Barkod: ${mapping.barcode}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {activeTab === "activity" ? (
            <div className="space-y-2">
              <InfoLine
                label="Oluşturulma"
                value={formatDate(product.createdAt)}
              />
              <InfoLine
                label="Son güncelleme"
                value={formatDate(product.updatedAt)}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function EmptyPanel({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-500">{message}</p>
      {children}
    </div>
  );
}
