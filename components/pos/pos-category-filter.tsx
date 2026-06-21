"use client";

import { buildPosFilterChips } from "@/lib/pos-page-ui-utils";
import type { PosQuickFilter } from "@/lib/pos-page-utils";

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
  const chips = buildPosFilterChips();

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const Icon = chip.icon;
        const active = !selectedCategoryId && quickFilter === chip.key;

        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => {
              onSelectCategory("");
              onQuickFilterChange(chip.key);
            }}
            className={[
              "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition",
              active ? chip.activeClass : chip.idleClass,
            ].join(" ")}
          >
            <Icon size={14} strokeWidth={2.4} />
            {chip.label}
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
              "h-10 rounded-full px-3.5 text-xs font-bold transition",
              active
                ? "bg-violet-600 text-white shadow-sm"
                : "border border-violet-100 bg-violet-50/60 text-violet-700 hover:bg-violet-50",
            ].join(" ")}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
