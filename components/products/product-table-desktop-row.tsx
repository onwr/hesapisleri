"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { ProductRowOverflowMenu } from "@/components/products/product-row-overflow-menu";
import { ProductsRowActions } from "@/components/products/products-row-actions";
import {
  getProductMarketplaceBadge,
  getProductPosVisibilityBadge,
  getProductStockBadge,
  getProductTypeBadge,
  printProductBarcode,
} from "@/lib/product-ui-utils";
import {
  formatProductMoney,
  getCategoryBadge,
  getProductStatusBadge,
  type ProductTableRow,
} from "@/lib/products-page-utils";

type ProductTableDesktopRowProps = {
  product: ProductTableRow;
  exportHref: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDeleteBlocked?: Parameters<typeof ProductsRowActions>[0]["onDeleteBlocked"];
};

export function ProductTableDesktopRow({
  product,
  exportHref,
  selected,
  onToggleSelect,
  onDeleteBlocked,
}: ProductTableDesktopRowProps) {
  const stockBadge = getProductStockBadge({
    stock: product.stock,
    minStock: product.minStock,
    isService: product.isService,
  });
  const typeBadge = getProductTypeBadge(product.productType);
  const statusBadge = getProductStatusBadge(product.status);
  const posBadge = getProductPosVisibilityBadge(product.status);
  const mappingBadge = getProductMarketplaceBadge(product.mappedChannels);

  return (
    <tr className="border-b border-slate-100 text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
          checked={selected}
          onChange={() => onToggleSelect(product.id)}
          aria-label={`${product.name} seç`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2.5">
          <Link href={`/products/${product.id}`}>
            <ProductThumbnail
              imageUrl={product.imageUrl}
              alt={product.name}
              size={40}
              iconSize={18}
              rounded="lg"
            />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/products/${product.id}`}
              className="block truncate font-black text-[#0f1f4d] hover:underline"
            >
              {product.name}
            </Link>
            <p className="truncate text-[11px] text-slate-500">
              {product.sku}
              {product.barcode ? ` · ${product.barcode}` : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span
          className={[
            "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
            getCategoryBadge(product.categoryName),
          ].join(" ")}
        >
          {product.categoryName}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-black text-[#0f1f4d]">
        {formatProductMoney(product.sellPrice)}
      </td>
      <td className="px-3 py-2 text-right font-black">
        {product.isService ? "Stoksuz" : product.stock}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <span
            className={[
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
              statusBadge.className,
            ].join(" ")}
          >
            {statusBadge.label}
          </span>
          <span
            className={[
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
              typeBadge.className,
            ].join(" ")}
          >
            {typeBadge.label}
          </span>
          <span
            className={[
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
              stockBadge.className,
            ].join(" ")}
          >
            {product.isService ? "Stoksuz" : stockBadge.label}
          </span>
          <span
            className={[
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
              posBadge.className,
            ].join(" ")}
          >
            {posBadge.label.replace("POS'ta ", "")}
          </span>
          {mappingBadge ? (
            <span
              className={[
                "inline-flex rounded-md px-2 py-0.5 text-[10px] font-black",
                mappingBadge.className,
              ].join(" ")}
            >
              {mappingBadge.label}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] hover:bg-slate-50"
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
      </td>
    </tr>
  );
}
