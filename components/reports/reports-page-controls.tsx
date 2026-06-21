"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Filter } from "lucide-react";
import {
  buildReportsQuery,
  formatDateInputValue,
  REPORT_TAB_LABELS,
  type ReportTabKey,
  type ReportViewKey,
} from "@/lib/reports-page-utils";

type ReportsPageControlsProps = {
  activeTab: ReportTabKey;
  activeReport?: string | null;
  from: Date;
  to: Date;
};

const tabKeys = Object.keys(REPORT_TAB_LABELS) as ReportTabKey[];

export function ReportsPageControls({
  activeTab,
  activeReport = null,
  from,
  to,
}: ReportsPageControlsProps) {
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
        buildReportsQuery({
          tab: activeReport ? undefined : activeTab,
          report: (activeReport as ReportViewKey | null) ?? null,
          from: nextFrom,
          to: nextTo,
        })
      );
    });
  }

  return (
    <section className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      {!activeReport ? (
        <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 xl:max-w-[620px] xl:grid-cols-5">
          {tabKeys.map((tabKey) => {
            const isActive = tabKey === activeTab;

            return (
              <Link
                key={tabKey}
                href={buildReportsQuery({
                  tab: tabKey,
                  from,
                  to,
                })}
                className={[
                  "flex min-h-[40px] items-center justify-center px-2 py-2.5 text-center text-[11px] font-extrabold leading-tight transition xl:text-[12px]",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "bg-white text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
                ].join(" ")}
              >
                {REPORT_TAB_LABELS[tabKey]}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-[12px] font-semibold text-slate-500">
          Seçili rapor için tarih aralığını güncelleyebilirsiniz.
        </div>
      )}

      <form
        onSubmit={handleFilterSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto"
      >
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
      </form>

      {error ? (
        <p className="text-[11px] font-semibold text-rose-500 xl:sr-only">{error}</p>
      ) : null}
    </section>
  );
}
