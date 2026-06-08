"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, ChevronDown, Filter, Search } from "lucide-react";
import {
  buildExpensesQuery,
  EXPENSE_TAB_LABELS,
  formatDateInputValue,
  type ExpenseTabKey,
} from "@/lib/expenses-page-utils";

type ExpensesTableControlsProps = {
  activeTab: ExpenseTabKey;
  from: Date;
  to: Date;
  searchQuery: string | null;
  categoryFilter?: string | null;
  categories?: string[];
  totalPages: number;
  currentPage: number;
  totalRecords: number;
};

const tabKeys = Object.keys(EXPENSE_TAB_LABELS) as ExpenseTabKey[];

export function ExpensesTableToolbar({
  activeTab,
  from,
  to,
  searchQuery,
  categoryFilter = null,
  categories = [],
}: Pick<
  ExpensesTableControlsProps,
  "activeTab" | "from" | "to" | "searchQuery" | "categoryFilter" | "categories"
>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(() => formatDateInputValue(from));
  const [toDate, setToDate] = useState(() => formatDateInputValue(to));
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");
  const [categoryValue, setCategoryValue] = useState(categoryFilter ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromDate(formatDateInputValue(from));
    setToDate(formatDateInputValue(to));
    setQueryValue(searchQuery ?? "");
    setCategoryValue(categoryFilter ?? "");
    setError(null);
  }, [from, to, searchQuery, categoryFilter]);

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
        buildExpensesQuery({
          tab: activeTab,
          page: 1,
          from: nextFrom,
          to: nextTo,
          q: queryValue.trim() || null,
          category: categoryValue.trim() || null,
        })
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
      <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildExpensesQuery({
                tab: tabKey,
                page: 1,
                from,
                to,
                q: searchQuery,
                category: categoryFilter,
              })}
              className={[
                "flex min-h-[40px] items-center justify-center px-2 py-2.5 text-center text-[11px] font-extrabold leading-tight transition xl:text-[12px]",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {EXPENSE_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <label className="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d] sm:min-w-[180px]">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            type="search"
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Gider ara..."
            className="w-full bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
        </label>

        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]">
          <CalendarDays size={16} className="text-slate-500" />
          <input
            type="date"
            name="from"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-[108px] bg-transparent outline-none"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            name="to"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-[108px] bg-transparent outline-none"
          />
          <ChevronDown size={15} className="text-slate-400" />
        </div>

        <select
          value={categoryValue}
          onChange={(event) => setCategoryValue(event.target.value)}
          className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d] outline-none"
        >
          <option value="">Tüm Kategoriler</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
        </button>

        {error ? (
          <p className="text-[11px] font-semibold text-rose-500">{error}</p>
        ) : null}
      </form>
    </div>
  );
}

export function ExpensesTablePagination({
  activeTab,
  from,
  to,
  searchQuery,
  categoryFilter = null,
  totalPages,
  currentPage,
  totalRecords,
}: ExpensesTableControlsProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords} gider kaydı
        {searchQuery ? (
          <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildExpensesQuery({
              tab: activeTab,
              page: currentPage - 1,
              from,
              to,
              q: searchQuery,
              category: categoryFilter,
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
            href={buildExpensesQuery({
              tab: activeTab,
              page,
              from,
              to,
              q: searchQuery,
              category: categoryFilter,
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
              href={buildExpensesQuery({
                tab: activeTab,
                page: totalPages,
                from,
                to,
                q: searchQuery,
                category: categoryFilter,
              })}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-black text-[#24345f] hover:bg-slate-50"
            >
              {totalPages}
            </Link>
          </>
        ) : null}

        {currentPage < totalPages ? (
          <Link
            href={buildExpensesQuery({
              tab: activeTab,
              page: currentPage + 1,
              from,
              to,
              q: searchQuery,
              category: categoryFilter,
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
