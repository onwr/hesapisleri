"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Filter, Plus, Search } from "lucide-react";
import {
  buildCashBankQuery,
  CASH_BANK_TAB_LABELS,
  type CashBankTabKey,
} from "@/lib/cash-bank-page-utils";

type CashBankTableControlsProps = {
  activeTab: CashBankTabKey;
  searchQuery: string | null;
  totalPages: number;
  currentPage: number;
  totalRecords: number;
};

const tabKeys = Object.keys(CASH_BANK_TAB_LABELS) as CashBankTabKey[];

export function CashBankTableToolbar({
  activeTab,
  searchQuery,
}: Pick<CashBankTableControlsProps, "activeTab" | "searchQuery">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");

  useEffect(() => {
    setQueryValue(searchQuery ?? "");
  }, [searchQuery]);

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      router.push(
        buildCashBankQuery({
          tab: activeTab,
          page: 1,
          q: queryValue.trim() || null,
        })
      );
    });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
      <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 xl:grid-cols-4">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildCashBankQuery({
                tab: tabKey,
                page: 1,
                q: searchQuery,
              })}
              className={[
                "flex min-h-[40px] items-center justify-center px-2 py-2.5 text-center text-[11px] font-extrabold leading-tight transition xl:text-[12px]",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {CASH_BANK_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
      >
        <label className="relative flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            type="search"
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Hesap veya hareket ara..."
            className="w-full bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
        </button>

        <Link
          href="/cash-bank"
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-[12px] font-black text-blue-600 shadow-sm transition hover:bg-blue-50"
        >
          <Plus size={16} strokeWidth={3} />
          Hesap Ekle
        </Link>
      </form>
    </div>
  );
}

export function CashBankTablePagination({
  activeTab,
  searchQuery,
  totalPages,
  currentPage,
  totalRecords,
}: CashBankTableControlsProps) {
  if (activeTab === "accounts") {
    return (
      <div className="border-t border-slate-100 px-4 py-3">
        <p className="text-[12px] font-semibold text-slate-500">
          Toplam {totalRecords} hesap bulundu
          {searchQuery ? (
            <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
          ) : null}
        </p>
      </div>
    );
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords} hareket
        {searchQuery ? (
          <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildCashBankQuery({
              tab: activeTab,
              page: currentPage - 1,
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
            href={buildCashBankQuery({
              tab: activeTab,
              page,
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

        {currentPage < totalPages ? (
          <Link
            href={buildCashBankQuery({
              tab: activeTab,
              page: currentPage + 1,
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
