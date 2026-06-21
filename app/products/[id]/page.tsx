import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { ProductDetailView } from "@/components/products/product-detail-view";
import { getProductDetailData } from "@/lib/product-detail-data";
import {
  PRODUCT_UNIT_LABELS,
  type ProductUnitType,
} from "@/lib/product-form-utils";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; stockUpdated?: string }>;
};

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const session = await guardPageModule("products");
  const company = session.company;
const { id } = await params;
  const query = await searchParams;

  const detail = await getProductDetailData(company.id, id);
  if (!detail) notFound();

  const {
    product,
    stockMovements,
    warehouseStocks,
    recentSales,
    channelMappings,
    isCriticalStock,
    formatted,
    monthSalesQuantity,
  } = detail;

  const unitLabel =
    PRODUCT_UNIT_LABELS[product.unitType as ProductUnitType] ?? "Adet";

  const showCreatedBanner = query.created === "1";
  const showUpdatedBanner = query.updated === "1";
  const showStockUpdatedBanner = query.stockUpdated === "1";

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} strokeWidth={2.6} />
          </Link>
          <p className="text-sm font-semibold text-slate-500">Ürün detayı</p>
        </div>

        {showCreatedBanner ? (
          <Banner tone="emerald" message="Ürün başarıyla oluşturuldu." />
        ) : null}

        {showUpdatedBanner ? (
          <Banner tone="blue" message="Ürün bilgileri güncellendi." />
        ) : null}

        {showStockUpdatedBanner ? (
          <Banner tone="orange" message="Stok hareketi başarıyla kaydedildi." />
        ) : null}

        {isCriticalStock ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              Kritik stok uyarısı: Mevcut stok ({product.stock} {unitLabel}),
              minimum seviyenin ({product.minStock} {unitLabel}) altında veya
              eşit.
            </div>
          </div>
        ) : null}

        <ProductDetailView
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            description: product.description,
            imageUrl: product.imageUrl,
            categoryName: product.categoryName,
            status: product.status,
            stock: product.stock,
            minStock: product.minStock,
            buyPrice: product.buyPrice,
            sellPrice: product.sellPrice,
            stockValue: product.stockValue,
            vatRate: product.vatRate,
            warehouseLocation: product.warehouseLocation,
            unitType: product.unitType,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
            isService: product.isService,
            productType: product.productType,
          }}
          formatted={formatted}
          monthSalesQuantity={monthSalesQuantity}
          unitLabel={unitLabel}
          stockMovements={stockMovements.map((movement) => ({
            id: movement.id,
            type: movement.type,
            quantity: movement.quantity,
            note: movement.note,
            movementDate: movement.movementDate?.toISOString() ?? null,
            createdAt: movement.createdAt.toISOString(),
            warehouse: movement.warehouse,
          }))}
          recentSales={recentSales.map((sale) => ({
            ...sale,
            createdAt: sale.createdAt.toISOString(),
          }))}
          channelMappings={channelMappings}
        />
      </div>
    </AppShell>
  );
}

function Banner({
  tone,
  message,
}: {
  tone: "emerald" | "blue" | "orange";
  message: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "border-blue-100 bg-blue-50 text-blue-700"
        : "border-orange-100 bg-orange-50 text-orange-700";

  return (
    <div className={["rounded-2xl border px-4 py-3 text-[13px] font-bold", toneClass].join(" ")}>
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} />
        {message}
      </div>
    </div>
  );
}
