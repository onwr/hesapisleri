"use client";

import {
  POS_QUICK_FILTER_LABELS,
  type PosQuickFilter,
} from "@/lib/pos-page-utils";

type CategoryOption = {
  id: string;
  name: string;
};

type PosCategoryFilterProps = {
  categories: CategoryOption[];
  selectedCategoryId: string;
  quickFilter: PosQuickFilter;
  onSelectCategory: (categoryId: string) => void;
  onQuickFilterChange: (filter: PosQuickFilter) => void;
};

export function PosCategoryFilter({
  categories,
  selectedCategoryId,
  quickFilter,
  onSelectCategory,
  onQuickFilterChange,
}: PosCategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(POS_QUICK_FILTER_LABELS) as PosQuickFilter[]).map((key) => {
        const active = !selectedCategoryId && quickFilter === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              onSelectCategory("");
              onQuickFilterChange(key);
            }}
            className={[
              "h-10 rounded-2xl px-3.5 text-xs font-bold transition",
              active
                ? "bg-[#0f1f4d] text-white shadow-sm"
                : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            {POS_QUICK_FILTER_LABELS[key]}
          </button>
        );
      })}

      {categories.map((category) => {
        const active = selectedCategoryId === category.id;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={[
              "h-10 rounded-2xl px-3.5 text-xs font-bold transition",
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
