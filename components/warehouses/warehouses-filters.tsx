"use client";

import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { PRODUCT_FILTER_CARD_CLASS } from "@/components/products/product-ui-tokens";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type WarehouseStatusFilter = "all" | "ACTIVE" | "PASSIVE";
export type WarehouseStockFilter = "all" | "low" | "empty";
export type WarehouseSortKey = "name" | "recent" | "stock" | "value";

export type WarehousesFilterState = {
  query: string;
  statusFilter: WarehouseStatusFilter;
  stockFilter: WarehouseStockFilter;
  sortKey: WarehouseSortKey;
};

export const DEFAULT_WAREHOUSES_FILTERS: WarehousesFilterState = {
  query: "",
  statusFilter: "all",
  stockFilter: "all",
  sortKey: "name",
};

type WarehousesFiltersProps = {
  filters: WarehousesFilterState;
  onChange: (filters: WarehousesFilterState) => void;
};

function SecondaryFilterFields({
  filters,
  onChange,
}: {
  filters: WarehousesFilterState;
  onChange: (filters: WarehousesFilterState) => void;
}) {
  return (
    <>
      <select
        value={filters.statusFilter}
        onChange={(event) =>
          onChange({
            ...filters,
            statusFilter: event.target.value as WarehouseStatusFilter,
          })
        }
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]"
        aria-label="Durum filtresi"
      >
        <option value="all">Tüm durumlar</option>
        <option value="ACTIVE">Aktif</option>
        <option value="PASSIVE">Pasif</option>
      </select>

      <select
        value={filters.stockFilter}
        onChange={(event) =>
          onChange({
            ...filters,
            stockFilter: event.target.value as WarehouseStockFilter,
          })
        }
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]"
        aria-label="Stok durumu filtresi"
      >
        <option value="all">Tüm stoklar</option>
        <option value="low">Düşük stok</option>
        <option value="empty">Stoksuz</option>
      </select>

      <select
        value={filters.sortKey}
        onChange={(event) =>
          onChange({
            ...filters,
            sortKey: event.target.value as WarehouseSortKey,
          })
        }
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]"
        aria-label="Sıralama"
      >
        <option value="name">Ada göre</option>
        <option value="recent">Son hareket</option>
        <option value="stock">Stok miktarı</option>
        <option value="value">Stok değeri</option>
      </select>
    </>
  );
}

function activeFilterCount(filters: WarehousesFilterState) {
  let count = 0;
  if (filters.statusFilter !== "all") count += 1;
  if (filters.stockFilter !== "all") count += 1;
  if (filters.sortKey !== "name") count += 1;
  if (filters.query.trim()) count += 1;
  return count;
}

function hasActiveFilters(filters: WarehousesFilterState) {
  return (
    filters.query.trim() !== "" ||
    filters.statusFilter !== "all" ||
    filters.stockFilter !== "all" ||
    filters.sortKey !== "name"
  );
}

export function WarehousesFilters({ filters, onChange }: WarehousesFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const extraCount = activeFilterCount(filters);

  return (
    <section className={PRODUCT_FILTER_CARD_CLASS}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Depo adı, kodu veya konum ara..."
            className="w-full min-w-0 bg-transparent text-[12px] font-semibold text-[#0f1f4d] outline-none"
            aria-label="Depo ara"
          />
        </label>

        <div className="hidden items-center gap-2 lg:flex">
          <SecondaryFilterFields filters={filters} onChange={onChange} />
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_WAREHOUSES_FILTERS)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[12px] font-black text-slate-600 transition hover:bg-slate-50"
            >
              <X size={14} />
              Filtreleri Temizle
            </button>
          ) : null}
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] lg:hidden"
              aria-label="Filtreleri aç"
            >
              <Filter size={14} />
              Filtreler
              {extraCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {extraCount}
                </span>
              ) : null}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Depo Filtreleri</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid gap-3">
              <SecondaryFilterFields filters={filters} onChange={onChange} />
              {hasActiveFilters(filters) ? (
                <button
                  type="button"
                  onClick={() => onChange(DEFAULT_WAREHOUSES_FILTERS)}
                  className="h-10 rounded-lg border border-slate-200 text-sm font-black text-slate-600"
                >
                  Filtreleri Temizle
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="h-10 rounded-lg bg-[#0f1f4d] text-sm font-black text-white"
              >
                Uygula
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </section>
  );
}
