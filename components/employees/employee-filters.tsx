"use client";

import { Search } from "lucide-react";
import {
  EMPLOYEE_SORT_OPTIONS,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  EMPLOYEE_TABS,
  EMPLOYMENT_TYPE_OPTIONS,
  type EmployeeSortKey,
  type EmployeeTabKey,
} from "@/lib/employee-page-utils";
import { TEAM_INPUT_CLASS } from "@/components/team/team-ui-tokens";

type EmployeeFiltersProps = {
  tab: EmployeeTabKey;
  search: string;
  department: string;
  jobTitle: string;
  status: string;
  employmentType: string;
  sort: EmployeeSortKey;
  departments: string[];
  jobTitles: string[];
  onTabChange: (tab: EmployeeTabKey) => void;
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onEmploymentTypeChange: (value: string) => void;
  onSortChange: (value: EmployeeSortKey) => void;
};

export function EmployeeFilters({
  tab,
  search,
  department,
  jobTitle,
  status,
  employmentType,
  sort,
  departments,
  jobTitles,
  onTabChange,
  onSearchChange,
  onDepartmentChange,
  onJobTitleChange,
  onStatusChange,
  onEmploymentTypeChange,
  onSortChange,
}: EmployeeFiltersProps) {
  return (
    <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {EMPLOYEE_TABS.map((item) => (
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative block xl:col-span-2">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Ad, e-posta, telefon veya departman ara..."
            className={[TEAM_INPUT_CLASS, "pl-11"].join(" ")}
          />
        </label>

        <select
          value={department}
          onChange={(event) => onDepartmentChange(event.target.value)}
          className={TEAM_INPUT_CLASS}
        >
          <option value="">Departman</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={jobTitle}
          onChange={(event) => onJobTitleChange(event.target.value)}
          className={TEAM_INPUT_CLASS}
        >
          <option value="">Görev</option>
          {jobTitles.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={TEAM_INPUT_CLASS}
        >
          {EMPLOYEE_STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={employmentType}
          onChange={(event) => onEmploymentTypeChange(event.target.value)}
          className={TEAM_INPUT_CLASS}
        >
          {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) =>
            onSortChange(event.target.value as EmployeeSortKey)
          }
          className={[TEAM_INPUT_CLASS, "xl:col-span-6"].join(" ")}
        >
          {EMPLOYEE_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sırala: {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
