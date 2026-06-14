"use client";

import Link from "next/link";
import {
  Boxes,
  Link2,
  Plus,
  Tags,
} from "lucide-react";
import { ProductsStockSyncButton } from "@/components/products/products-stock-sync-button";
import { PRODUCT_STATS_BAR_CLASS } from "@/components/products/product-ui-tokens";
import { formatProductMoney, formatProductNumber } from "@/lib/products-page-utils";
import type { ProductPageStats } from "@/lib/products-page-data";
import type { ReactNode } from "react";

type ProductsShellProps = {
  stats: ProductPageStats;
  canSyncStock?: boolean;
  children: ReactNode;
};

function ToolbarButton({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <Link
        href={href}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white transition hover:bg-[#162a5c]"
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

export function ProductsShell({ stats, canSyncStock = false, children }: ProductsShellProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Ürünler
          </h1>
          <p className="text-[12px] font-medium text-slate-500">
            Ürün, stok, fiyat ve barkod yönetimi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton href="/products/new" primary>
            <Plus size={14} />
            Ürün Ekle
          </ToolbarButton>
          <ToolbarButton href="#products-list">Toplu İşlem</ToolbarButton>
          <ToolbarButton href="/stocks">
            <Boxes size={14} />
            Stok Hareketi
          </ToolbarButton>
          <ToolbarButton href="/products/categories">
            <Tags size={14} />
            Kategoriler
          </ToolbarButton>
          <ToolbarButton href="/products/channel-mapping">
            <Link2 size={14} />
            SKU Eşlemeleri
          </ToolbarButton>
          <ProductsStockSyncButton canSync={canSyncStock} compact />
        </div>
      </div>

      <section className={PRODUCT_STATS_BAR_CLASS}>
        <StatPill label="Toplam" value={formatProductNumber(stats.totalProducts)} />
        <StatPill label="Aktif" value={formatProductNumber(stats.activeProducts)} />
        <StatPill
          label="Düşük Stok"
          value={formatProductNumber(stats.lowStockProducts)}
          tone="amber"
        />
        <StatPill
          label="Stok Yok"
          value={formatProductNumber(stats.outOfStockProducts)}
          tone="rose"
        />
        <StatPill
          label="Stok Değeri"
          value={formatProductMoney(stats.totalStockValue)}
          tone="blue"
        />
      </section>

      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "amber" | "rose" | "blue";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "blue"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${toneClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <p className="text-[13px] font-black leading-tight">{value}</p>
    </div>
  );
}
