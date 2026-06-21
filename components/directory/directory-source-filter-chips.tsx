"use client";

import {
  applyDirectoryFilterChip,
  buildDirectoryFilterChips,
  getActiveDirectoryFilterChip,
  type DirectorySourceFilterKey,
} from "@/lib/directory-page-ui-utils";

type DirectorySourceFilterChipsProps = {
  sourceType: string;
  favorite: string;
  onChange: (next: { sourceType: string; favorite: string }) => void;
};

export function DirectorySourceFilterChips({
  sourceType,
  favorite,
  onChange,
}: DirectorySourceFilterChipsProps) {
  const chips = buildDirectoryFilterChips();
  const activeKey = getActiveDirectoryFilterChip({ sourceType, favorite });

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const Icon = chip.icon;
        const active = activeKey === chip.key;

        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(applyDirectoryFilterChip(chip.key))}
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
    </div>
  );
}

export type { DirectorySourceFilterKey };
