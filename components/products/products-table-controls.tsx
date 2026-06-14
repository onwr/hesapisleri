"use client";

import Link from "next/link";
import {
  buildProductsQuery,
  type ProductTabKey,
} from "@/lib/products-page-utils";
import type { ProductSortKey, ProductStockFilterKey } from "@/lib/product-ui-utils";

type ProductsTablePaginationProps = {
  activeTab: ProductTabKey;
  activeCategory: string | null;
  searchQuery: string | null;
  stockFilter: ProductStockFilterKey;
  sortKey: ProductSortKey;
  totalPages: number;
  currentPage: number;
  totalRecords: number;
};

export function ProductsTablePagination({
  activeTab,
  activeCategory,
  searchQuery,
  stockFilter,
  sortKey,
  totalPages,
  currentPage,
  totalRecords,
}: ProductsTablePaginationProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  function pageHref(page: number) {
    return buildProductsQuery({
      tab: activeTab,
      page,
      category: activeCategory,
      q: searchQuery,
      stock: stockFilter === "all" ? null : stockFilter,
      sort: sortKey === "recent" ? null : sortKey,
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords} ürün
        {searchQuery ? (
          <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
        ) : null}
        {activeCategory ? (
          <span className="text-slate-400"> · {activeCategory}</span>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={pageHref(currentPage - 1)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-[#24345f] transition hover:bg-slate-50"
          >
            Önceki
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-slate-300">
            Önceki
          </span>
        )}

        {pageNumbers.map((page) => (
          <Link
            key={page}
            href={pageHref(page)}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-black",
              page === currentPage
                ? "bg-[#0f1f4d] text-white shadow-sm"
                : "border border-slate-200 bg-white text-[#24345f] hover:bg-slate-50",
            ].join(" ")}
          >
            {page}
          </Link>
        ))}

        {totalPages > 5 ? (
          <>
            <span className="px-1 text-[12px] font-black text-slate-400">...</span>
            <Link
              href={pageHref(totalPages)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-black text-[#24345f] hover:bg-slate-50"
            >
              {totalPages}
            </Link>
          </>
        ) : null}

        {currentPage < totalPages ? (
          <Link
            href={pageHref(currentPage + 1)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-[#24345f] transition hover:bg-slate-50"
          >
            Sonraki
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-slate-300">
            Sonraki
          </span>
        )}
      </div>
    </div>
  );
}
