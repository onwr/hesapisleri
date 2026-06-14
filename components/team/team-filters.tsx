"use client";

import { Search } from "lucide-react";
import {
  TEAM_ROLE_FILTERS,
  TEAM_SORT_OPTIONS,
  TEAM_TABS,
  type TeamSortKey,
  type TeamTabKey,
} from "@/lib/team-page-utils";

type TeamFiltersProps = {
  tab: TeamTabKey;
  search: string;
  roleFilter: string;
  sort: TeamSortKey;
  onTabChange: (tab: TeamTabKey) => void;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSortChange: (value: TeamSortKey) => void;
};

export function TeamFilters({
  tab,
  search,
  roleFilter,
  sort,
  onTabChange,
  onSearchChange,
  onRoleChange,
  onSortChange,
}: TeamFiltersProps) {
  return (
    <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {TEAM_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={[
              "rounded-full px-4 py-2 text-xs font-black transition",
              tab === item.key
                ? "bg-[#0f1f4d] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Ad veya e-posta ara..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <select
          value={roleFilter}
          onChange={(event) => onRoleChange(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        >
          {TEAM_ROLE_FILTERS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as TeamSortKey)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        >
          {TEAM_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
