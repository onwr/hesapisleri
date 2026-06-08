"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, ChevronDown, Download, Filter } from "lucide-react";
import {
  buildSalesQuery,
  formatDateDisplay,
  formatDateInputValue,
  SALES_TAB_LABELS,
  type SalesTabKey,
} from "@/lib/sales-page-utils";

type SalesTableControlsProps = {
  activeTab: SalesTabKey;
  from: Date;
  to: Date;
  totalPages: number;
  currentPage: number;
  totalRecords: number;
};

const tabKeys = Object.keys(SALES_TAB_LABELS) as SalesTabKey[];

export function SalesTableToolbar({
  activeTab,
  from,
  to,
  exportHref,
}: Pick<SalesTableControlsProps, "activeTab" | "from" | "to"> & {
  exportHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(() => formatDateInputValue(from));
  const [toDate, setToDate] = useState(() => formatDateInputValue(to));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFromDate(formatDateInputValue(from));
    setToDate(formatDateInputValue(to));
    setError(null);
  }, [from, to]);

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
        buildSalesQuery({
          tab: activeTab,
          page: 1,
          from: nextFrom,
          to: nextTo,
        })
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex overflow-x-auto items-center  rounded-xl border border-slate-200 bg-white">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildSalesQuery({ tab: tabKey, page: 1, from, to })}
              className={[
                "py-2 min-w-[96px] border-r border-slate-100 px-4 text-center text-[12px] font-extrabold transition last:border-r-0",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {SALES_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
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

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        <a
          href={exportHref}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50"
        >
          <Download size={16} />
          Dışa Aktar
        </a>

        {error ? (
          <p className="text-[11px] font-semibold text-rose-500">{error}</p>
        ) : null}
      </form>
    </div>
  );
}

export function SalesTablePagination({
  activeTab,
  from,
  to,
  totalPages,
  currentPage,
  totalRecords,
}: SalesTableControlsProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords} kayıt
        {totalRecords > 0 ? (
          <span className="text-slate-400">
            {" "}
            · {formatDateDisplay(from)} - {formatDateDisplay(to)}
          </span>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildSalesQuery({
              tab: activeTab,
              page: currentPage - 1,
              from,
              to,
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
            href={buildSalesQuery({
              tab: activeTab,
              page,
              from,
              to,
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

        {currentPage < totalPages ? (
          <Link
            href={buildSalesQuery({
              tab: activeTab,
              page: currentPage + 1,
              from,
              to,
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
