"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Filter, Search } from "lucide-react";
import {
  PRODUCT_FILTER_CARD_CLASS,
  PRODUCT_INPUT_CLASS,
} from "@/components/products/product-ui-tokens";
import {
  PRODUCT_SORT_LABELS,
  PRODUCT_STOCK_FILTER_LABELS,
  type ProductSortKey,
  type ProductStockFilterKey,
} from "@/lib/product-ui-utils";
import {
  buildProductsQuery,
  PRODUCT_TAB_LABELS,
  type ProductTabKey,
} from "@/lib/products-page-utils";

type ProductsFiltersProps = {
  activeTab: ProductTabKey;
  activeCategory: string | null;
  searchQuery: string | null;
  stockFilter: ProductStockFilterKey;
  sortKey: ProductSortKey;
  categories: string[];
};

const statusOptions: Array<{ value: ProductTabKey; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "passive", label: "Pasif" },
];

export function ProductsFilters({
  activeTab,
  activeCategory,
  searchQuery,
  stockFilter,
  sortKey,
  categories,
}: ProductsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState(activeCategory ?? "all");
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");
  const [statusValue, setStatusValue] = useState<ProductTabKey>(activeTab);
  const [stockValue, setStockValue] = useState<ProductStockFilterKey>(stockFilter);
  const [sortValue, setSortValue] = useState<ProductSortKey>(sortKey);
  const [typeValue, setTypeValue] = useState<ProductTabKey>(
    activeTab === "service" || activeTab === "product" ? activeTab : "all"
  );

  useEffect(() => {
    setCategoryValue(activeCategory ?? "all");
    setQueryValue(searchQuery ?? "");
    setStatusValue(
      activeTab === "active" || activeTab === "passive" ? activeTab : "all"
    );
    setStockValue(stockFilter);
    setSortValue(sortKey);
    setTypeValue(
      activeTab === "service" || activeTab === "product" ? activeTab : "all"
    );
  }, [activeCategory, searchQuery, activeTab, stockFilter, sortKey]);

  function resolveTab(): ProductTabKey {
    if (typeValue === "service" || typeValue === "product") {
      return typeValue;
    }

    if (stockValue === "low_stock") {
      return "lowStock";
    }

    return statusValue;
  }

  function applyFilters(overrides?: {
    category?: string;
    q?: string;
    tab?: ProductTabKey;
    stock?: ProductStockFilterKey;
    sort?: ProductSortKey;
  }) {
    const nextCategory = overrides?.category ?? categoryValue;
    const nextQuery = overrides?.q ?? queryValue;
    const nextStock = overrides?.stock ?? stockValue;
    const nextSort = overrides?.sort ?? sortValue;
    const nextTab = overrides?.tab ?? resolveTab();

    startTransition(() => {
      router.push(
        buildProductsQuery({
          tab: nextTab,
          page: 1,
          category: nextCategory === "all" ? null : nextCategory,
          q: nextQuery.trim() || null,
          stock: nextStock === "all" ? null : nextStock,
          sort: nextSort === "recent" ? null : nextSort,
        })
      );
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  const selectClass =
    "h-9 w-full cursor-pointer appearance-none rounded-lg border border-slate-200/80 bg-white px-3 pr-8 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

  return (
    <section className={PRODUCT_FILTER_CARD_CLASS}>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={queryValue}
              onChange={(event) => setQueryValue(event.target.value)}
              placeholder="Ürün adı, barkod veya SKU ara..."
              className={`${PRODUCT_INPUT_CLASS} pl-9`}
            />
          </label>

          <label className="relative w-full xl:w-[160px]">
            <select
              value={categoryValue}
              onChange={(event) => {
                const next = event.target.value;
                setCategoryValue(next);
                applyFilters({ category: next });
              }}
              className={selectClass}
            >
              <option value="all">Tüm kategoriler</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </label>

          <label className="relative w-full xl:w-[130px]">
            <select
              value={stockValue}
              onChange={(event) => {
                const next = event.target.value as ProductStockFilterKey;
                setStockValue(next);
                applyFilters({ stock: next });
              }}
              className={selectClass}
            >
              {Object.entries(PRODUCT_STOCK_FILTER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </label>

          <label className="relative w-full xl:w-[120px]">
            <select
              value={statusValue}
              onChange={(event) => {
                const next = event.target.value as ProductTabKey;
                setStatusValue(next);
                setTypeValue("all");
                applyFilters({ tab: next });
              }}
              className={selectClass}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </label>

          <label className="relative w-full xl:w-[150px]">
            <select
              value={sortValue}
              onChange={(event) => {
                const next = event.target.value as ProductSortKey;
                setSortValue(next);
                applyFilters({ sort: next });
              }}
              className={selectClass}
            >
              {Object.entries(PRODUCT_SORT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#162a5c] disabled:opacity-60"
          >
            {isPending ? "..." : "Filtrele"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition hover:text-[#0f1f4d]"
          >
            <Filter size={13} />
            Gelişmiş filtreler
            <ChevronDown
              size={13}
              className={advancedOpen ? "rotate-180 transition" : "transition"}
            />
          </button>
        </div>

        {advancedOpen ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] font-bold text-slate-500">Ürün tipi</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["all", "product", "service"] as const).map((key) => {
                const label =
                  key === "all"
                    ? "Tümü"
                    : key === "product"
                      ? PRODUCT_TAB_LABELS.product
                      : PRODUCT_TAB_LABELS.service;
                const active = typeValue === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTypeValue(key);
                      setStatusValue("all");
                      setStockValue("all");
                      applyFilters({
                        tab: key === "all" ? "all" : key,
                        stock: "all",
                      });
                    }}
                    className={[
                      "rounded-md px-2.5 py-1 text-[11px] font-black transition",
                      active
                        ? "bg-white text-[#0f1f4d] shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-[#0f1f4d]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
