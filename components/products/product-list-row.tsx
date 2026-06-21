"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { ProductRowOverflowMenu } from "@/components/products/product-row-overflow-menu";
import { ProductsRowActions } from "@/components/products/products-row-actions";
import { PRODUCT_LIST_ROW_CLASS } from "@/components/products/product-ui-tokens";
import {
  getProductMarketplaceBadge,
  getProductPosVisibilityBadge,
  getProductStockBadge,
  getProductTypeBadge,
  printProductBarcode,
} from "@/lib/product-ui-utils";
import {
  formatProductMoney,
  getProductStatusBadge,
  type ProductTableRow,
} from "@/lib/products-page-utils";

type ProductListRowProps = {
  product: ProductTableRow;
  exportHref: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  showCheckbox?: boolean;
  onDeleteBlocked?: Parameters<typeof ProductsRowActions>[0]["onDeleteBlocked"];
};

export function ProductListRow({
  product,
  exportHref,
  selected = false,
  onToggleSelect,
  showCheckbox = false,
  onDeleteBlocked,
}: ProductListRowProps) {
  const typeBadge = getProductTypeBadge(product.productType);
  const stockBadge = getProductStockBadge({
    stock: product.stock,
    minStock: product.minStock,
    isService: product.isService,
  });
  const statusBadge = getProductStatusBadge(product.status);
  const posBadge = getProductPosVisibilityBadge(product.status);
  const mappingBadge = getProductMarketplaceBadge(product.mappedChannels);

  return (
    <article
      className={[
        PRODUCT_LIST_ROW_CLASS,
        selected ? "border-blue-200 bg-blue-50/30" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showCheckbox ? (
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
            checked={selected}
            onChange={() => onToggleSelect?.(product.id)}
            aria-label={`${product.name} seç`}
          />
        ) : null}

        <Link href={`/products/${product.id}`} className="shrink-0">
          <ProductThumbnail
            imageUrl={product.imageUrl}
            alt={product.name}
            size={44}
            iconSize={18}
            rounded="lg"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/products/${product.id}`}
            className="truncate text-[14px] font-extrabold text-[#0f1f4d] hover:underline"
          >
            {product.name}
          </Link>
          <p className="truncate text-[11px] font-medium text-slate-500">
            {product.sku}
            {product.barcode ? ` · ${product.barcode}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={[
                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
                typeBadge.className,
              ].join(" ")}
            >
              {typeBadge.label}
            </span>
            <span
              className={[
                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
                stockBadge.className,
              ].join(" ")}
            >
              {product.isService ? "Stoksuz" : stockBadge.label}
            </span>
            <span
              className={[
                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
                statusBadge.className,
              ].join(" ")}
            >
              {statusBadge.label}
            </span>
            <span
              className={[
                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
                posBadge.className,
              ].join(" ")}
            >
              POS
            </span>
            {mappingBadge ? (
              <span
                className={[
                  "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
                  mappingBadge.className,
                ].join(" ")}
              >
                {mappingBadge.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <div className="text-right text-[12px] font-black text-[#0f1f4d]">
          {formatProductMoney(product.sellPrice)}
          <p className="text-[11px] font-semibold text-slate-500">
            {product.isService ? "—" : `${product.stock} stok`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              printProductBarcode({
                name: product.name,
                barcode: product.barcode,
                sku: product.sku,
                sellPriceLabel: formatProductMoney(product.sellPrice),
              })
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f]"
            title="Barkod Yazdır"
          >
            <Printer size={14} />
          </button>

          <ProductRowOverflowMenu
            row={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              status: product.status,
              isService: product.isService,
              exportHref,
              sellPriceLabel: formatProductMoney(product.sellPrice),
            }}
            onDeleteBlocked={onDeleteBlocked}
          />
        </div>
      </div>
    </article>
  );
}
