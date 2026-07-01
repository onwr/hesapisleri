"use client";

import type { ReactNode } from "react";

type ResponsivePageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/**
 * Standart sayfa başlığı:
 * - Masaüstü: başlık/açıklama solda, aksiyonlar sağda
 * - Mobil: başlık üstte tam genişlik, aksiyonlar altta tam genişlik
 */
export function ResponsivePageHeader({
  title,
  description,
  actions,
}: ResponsivePageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[20px] font-black leading-tight tracking-[-0.02em] text-[#0f1f4d] sm:text-[24px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] font-medium text-slate-500 sm:text-[14px]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
