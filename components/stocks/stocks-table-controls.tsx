"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Filter, Plus, Search } from "lucide-react";
import {
  buildStocksQuery,
  formatDateInputValue,
  isMovementTab,
  isTransferTab,
  isWarehouseTab,
  PRODUCTS_STOCKS_WAREHOUSES_PATH,
  STOCK_TAB_LABELS,
  type StockTabKey,
} from "@/lib/stocks-page-utils";

type StocksTableControlsProps = {
  activeTab: StockTabKey;
  from: Date;
  to: Date;
  searchQuery: string | null;
  productId?: string | null;
  totalPages: number;
  currentPage: number;
  totalRecords: number;
  movementMode: boolean;
};

const tabKeys = Object.keys(STOCK_TAB_LABELS) as StockTabKey[];

function stocksQueryParams(
  params: {
    activeTab: StockTabKey;
    from: Date | string;
    to: Date | string;
    searchQuery: string | null;
    productId?: string | null;
    page?: number;
  }
) {
  return {
    tab: params.activeTab,
    page: params.page,
    from: params.from,
    to: params.to,
    q: params.searchQuery,
    productId: params.productId,
  };
}

export function StocksTableToolbar({
  activeTab,
  from,
  to,
  searchQuery,
  productId,
}: Pick<
  StocksTableControlsProps,
  "activeTab" | "from" | "to" | "searchQuery" | "productId"
>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(() => formatDateInputValue(from));
  const [toDate, setToDate] = useState(() => formatDateInputValue(to));
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");
  const [error, setError] = useState<string | null>(null);
  const movementMode = isMovementTab(activeTab);
  const transferMode = isTransferTab(activeTab);
  const warehouseMode = isWarehouseTab(activeTab);
  const specialMode = movementMode || transferMode || warehouseMode;

  useEffect(() => {
    setFromDate(formatDateInputValue(from));
    setToDate(formatDateInputValue(to));
    setQueryValue(searchQuery ?? "");
    setError(null);
  }, [from, to, searchQuery]);

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!fromDate || !toDate) {
      setError("Başlangıç ve bitiş tarihi seçin.");
      return;
    }

    let nextFrom = fromDate;
    let nextTo = toDate;

    if (nextFrom > nextTo) {
      [nextFrom, nextTo] = [nextTo, nextFrom];
      setFromDate(nextFrom);
      setToDate(nextTo);
    }

    startTransition(() => {
      router.push(
        buildStocksQuery(
          stocksQueryParams({
            activeTab,
            page: 1,
            from: nextFrom,
            to: nextTo,
            searchQuery: queryValue.trim() || null,
            productId,
          })
        )
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
      <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 xl:grid-cols-7">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildStocksQuery(
                stocksQueryParams({
                  activeTab: tabKey,
                  page: 1,
                  from,
                  to,
                  searchQuery,
                  productId,
                })
              )}
              className={[
                "flex min-h-[40px] items-center justify-center px-2 py-2.5 text-center text-[10px] font-extrabold leading-tight transition xl:text-[11px]",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {STOCK_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex w-full flex-col gap-2 lg:flex-row lg:items-center"
      >
        <label className="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d] sm:min-w-[180px]">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            type="search"
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder={
              transferMode
                ? "Transfer no, ürün veya depo ara..."
                : warehouseMode
                  ? "Depo adı veya kodu ara..."
                  : movementMode
                    ? "Ürün veya hareket ara..."
                    : "Ürün adı, stok kodu veya kategori ara..."
            }
            className="w-full bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
        </label>

        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-[#0f1f4d]">
          <CalendarDays size={16} className="shrink-0 text-slate-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-[118px] bg-transparent outline-none"
            aria-label="Başlangıç tarihi"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-[118px] bg-transparent outline-none"
            aria-label="Bitiş tarihi"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
        </button>

        <Link
          href={PRODUCTS_STOCKS_WAREHOUSES_PATH}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50"
        >
          Depolar
        </Link>

        <Link
          href="/products/new"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 px-4 text-[12px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95"
        >
          <Plus size={16} strokeWidth={3} />
          Ürün Ekle
        </Link>
      </form>

      {error ? (
        <p className="text-[11px] font-semibold text-rose-500">{error}</p>
      ) : null}

      {specialMode ? (
        <p className="text-[11px] font-medium text-slate-500">
          Tarih filtresi {transferMode ? "transfer" : warehouseMode ? "kayıt" : "hareket"} kayıtlarına uygulanır.
        </p>
      ) : null}
    </div>
  );
}

export function StocksTablePagination({
  activeTab,
  from,
  to,
  searchQuery,
  productId,
  totalPages,
  currentPage,
  totalRecords,
  movementMode,
}: StocksTableControlsProps) {
  const transferMode = isTransferTab(activeTab);
  const warehouseMode = isWarehouseTab(activeTab);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords}{" "}
        {movementMode
          ? "hareket"
          : transferMode
            ? "transfer"
            : warehouseMode
              ? "depo"
              : "stok kaydı"}
        {searchQuery ? (
          <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildStocksQuery(
              stocksQueryParams({
                activeTab,
                page: currentPage - 1,
                from,
                to,
                searchQuery,
                productId,
              })
            )}
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
            href={buildStocksQuery(
              stocksQueryParams({
                activeTab,
                page,
                from,
                to,
                searchQuery,
                productId,
              })
            )}
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

        {currentPage < totalPages ? (
          <Link
            href={buildStocksQuery(
              stocksQueryParams({
                activeTab,
                page: currentPage + 1,
                from,
                to,
                searchQuery,
                productId,
              })
            )}
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
