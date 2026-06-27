"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  buildAdminOverviewSearchParams,
  type AdminOverviewPeriod,
} from "@/lib/admin/admin-overview-period-utils";

const PRESETS: Array<{ key: AdminOverviewPeriod["key"]; label: string }> = [
  { key: "today", label: "Bugün" },
  { key: "7d", label: "Son 7 gün" },
  { key: "30d", label: "Son 30 gün" },
  { key: "90d", label: "Son 90 gün" },
  { key: "this_month", label: "Bu ay" },
  { key: "last_month", label: "Geçen ay" },
];

type Props = {
  period: AdminOverviewPeriod["key"];
  from: string;
  to: string;
};

export function AdminOverviewDateFilter({ period, from, to }: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from.slice(0, 10));
  const [customTo, setCustomTo] = useState(to.slice(0, 10));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const active = period === preset.key;
          return (
            <Link
              key={preset.key}
              href={`/admin?range=${preset.key}`}
              className={[
                "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                active
                  ? "bg-[#0f1f4d] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(
            `/admin?range=custom&from=${customFrom}&to=${customTo}`
          );
        }}
      >
        <input
          type="date"
          value={customFrom}
          onChange={(event) => setCustomFrom(event.target.value)}
          className="rounded-xl border border-slate-200 px-2 py-1.5 text-[12px]"
        />
        <span className="text-[12px] text-slate-400">—</span>
        <input
          type="date"
          value={customTo}
          onChange={(event) => setCustomTo(event.target.value)}
          className="rounded-xl border border-slate-200 px-2 py-1.5 text-[12px]"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-bold text-white"
        >
          Uygula
        </button>
        {period === "custom" ? (
          <span className="text-[11px] font-medium text-slate-500">
            {buildAdminOverviewSearchParams({
              key: "custom",
              from: new Date(from),
              to: new Date(to),
              comparisonFrom: new Date(),
              comparisonTo: new Date(),
              label: "",
              timezone: "Europe/Istanbul",
            })}
          </span>
        ) : null}
      </form>
    </div>
  );
}
