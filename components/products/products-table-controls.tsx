"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Filter, Package, Plus, Search } from "lucide-react";
import {
  buildProductsQuery,
  PRODUCT_TAB_LABELS,
  type ProductTabKey,
} from "@/lib/products-page-utils";

type ProductsTableControlsProps = {
  activeTab: ProductTabKey;
  activeCategory: string | null;
  searchQuery: string | null;
  categories: string[];
  totalPages: number;
  currentPage: number;
  totalRecords: number;
};

const tabKeys = Object.keys(PRODUCT_TAB_LABELS) as ProductTabKey[];

export function ProductsTableToolbar({
  activeTab,
  activeCategory,
  searchQuery,
  categories,
}: Pick<
  ProductsTableControlsProps,
  "activeTab" | "activeCategory" | "searchQuery" | "categories"
>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryValue, setCategoryValue] = useState(activeCategory ?? "all");
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");

  useEffect(() => {
    setCategoryValue(activeCategory ?? "all");
    setQueryValue(searchQuery ?? "");
  }, [activeCategory, searchQuery]);

  function applyFilters(nextCategory = categoryValue, nextQuery = queryValue) {
    startTransition(() => {
      router.push(
        buildProductsQuery({
          tab: activeTab,
          page: 1,
          category: nextCategory === "all" ? null : nextCategory,
          q: nextQuery.trim() || null,
        })
      );
    });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildProductsQuery({
                tab: tabKey,
                page: 1,
                category: activeCategory,
                q: searchQuery,
              })}
              className={[
                "flex min-w-[92px] items-start justify-center border-r border-slate-100 px-4 py-2.5 text-center text-[12px] font-extrabold leading-none transition last:border-r-0",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {PRODUCT_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label className="relative flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            type="search"
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Ürün ara..."
            className="w-full bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
        </label>

        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d]">
          <Package size={16} className="text-slate-500" />
          <select
            value={categoryValue}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategoryValue(nextCategory);
              applyFilters(nextCategory, queryValue);
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="all">Tüm Gruplar</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 text-slate-400"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        <Link
          href="/products/new"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 px-4 text-[12px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95"
        >
          <Plus size={16} strokeWidth={3} />
          Ürün Ekle
        </Link>
      </form>
    </div>
  );
}

export function ProductsTablePagination({
  activeTab,
  activeCategory,
  searchQuery,
  totalPages,
  currentPage,
  totalRecords,
}: Pick<
  ProductsTableControlsProps,
  | "activeTab"
  | "activeCategory"
  | "searchQuery"
  | "totalPages"
  | "currentPage"
  | "totalRecords"
>) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

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
            href={buildProductsQuery({
              tab: activeTab,
              page: currentPage - 1,
              category: activeCategory,
              q: searchQuery,
            })}
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
            href={buildProductsQuery({
              tab: activeTab,
              page,
              category: activeCategory,
              q: searchQuery,
            })}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-black",
              page === currentPage
                ? "bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-100"
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
              href={buildProductsQuery({
                tab: activeTab,
                page: totalPages,
                category: activeCategory,
                q: searchQuery,
              })}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-black text-[#24345f] hover:bg-slate-50"
            >
              {totalPages}
            </Link>
          </>
        ) : null}

        {currentPage < totalPages ? (
          <Link
            href={buildProductsQuery({
              tab: activeTab,
              page: currentPage + 1,
              category: activeCategory,
              q: searchQuery,
            })}
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
