"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Filter, Plus, Search, Truck } from "lucide-react";
import {
  buildSuppliersQuery,
  SUPPLIER_TAB_LABELS,
  type SupplierListBalanceDirection,
  type SupplierTabKey,
} from "@/lib/suppliers-page-utils";

type SuppliersTableControlsProps = {
  activeTab: SupplierTabKey;
  activeCategory: string | null;
  searchQuery: string | null;
  categories: string[];
  totalPages: number;
  currentPage: number;
  totalRecords: number;
  favoriteOnly: boolean;
  balanceDirection: SupplierListBalanceDirection;
  customerRole: "all" | "with" | "without";
  lastActivityFrom: string | null;
  statusFilter: "all" | "active" | "passive";
};

const tabKeys = Object.keys(SUPPLIER_TAB_LABELS) as SupplierTabKey[];

export function SuppliersTableToolbar({
  activeTab,
  activeCategory,
  searchQuery,
  categories,
  favoriteOnly,
  balanceDirection,
  customerRole,
  lastActivityFrom,
  statusFilter,
}: Pick<
  SuppliersTableControlsProps,
  | "activeTab"
  | "activeCategory"
  | "searchQuery"
  | "categories"
  | "favoriteOnly"
  | "balanceDirection"
  | "customerRole"
  | "lastActivityFrom"
  | "statusFilter"
>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryValue, setCategoryValue] = useState(activeCategory ?? "all");
  const [queryValue, setQueryValue] = useState(searchQuery ?? "");
  const [directionValue, setDirectionValue] = useState(balanceDirection);
  const [roleValue, setRoleValue] = useState(customerRole);
  const [activityFromValue, setActivityFromValue] = useState(lastActivityFrom ?? "");
  const [statusValue, setStatusValue] = useState(statusFilter);

  useEffect(() => {
    setCategoryValue(activeCategory ?? "all");
    setQueryValue(searchQuery ?? "");
    setDirectionValue(balanceDirection);
    setRoleValue(customerRole);
    setActivityFromValue(lastActivityFrom ?? "");
    setStatusValue(statusFilter);
  }, [
    activeCategory,
    searchQuery,
    balanceDirection,
    customerRole,
    lastActivityFrom,
    statusFilter,
  ]);

  function applyFilters(overrides?: {
    category?: string;
    query?: string;
    direction?: SupplierListBalanceDirection;
    role?: "all" | "with" | "without";
    activityFrom?: string;
    status?: "all" | "active" | "passive";
  }) {
    const nextCategory = overrides?.category ?? categoryValue;
    const nextQuery = overrides?.query ?? queryValue;
    const nextDirection = overrides?.direction ?? directionValue;
    const nextRole = overrides?.role ?? roleValue;
    const nextActivityFrom = overrides?.activityFrom ?? activityFromValue;
    const nextStatus = overrides?.status ?? statusValue;

    startTransition(() => {
      router.push(
        buildSuppliersQuery({
          tab: activeTab,
          page: 1,
          category: nextCategory === "all" ? null : nextCategory,
          q: nextQuery.trim() || null,
          favorite: favoriteOnly,
          balanceDirection: nextDirection,
          customerRole: nextRole,
          lastActivityFrom: nextActivityFrom.trim() || null,
          status: nextStatus,
        })
      );
    });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {tabKeys.map((tabKey) => {
          const isActive = tabKey === activeTab;

          return (
            <Link
              key={tabKey}
              href={buildSuppliersQuery({
                tab: tabKey,
                page: 1,
                category: activeCategory,
                q: searchQuery,
                favorite: favoriteOnly,
                balanceDirection,
                customerRole,
                lastActivityFrom,
                status: statusFilter,
              })}
              className={[
                "flex min-w-[92px] items-start justify-center border-r border-slate-100 px-4 py-2.5 text-center text-[12px] font-extrabold leading-none transition last:border-r-0",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
              ].join(" ")}
            >
              {SUPPLIER_TAB_LABELS[tabKey]}
            </Link>
          );
        })}
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label className="relative flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]">
          <Search size={16} className="shrink-0 text-slate-500" />
          <input
            type="search"
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder="Tedarikçi ara..."
            className="w-full bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
        </label>

        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d]">
          <Truck size={16} className="text-slate-500" />
          <select
            value={categoryValue}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategoryValue(nextCategory);
              applyFilters({ category: nextCategory });
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 text-slate-400"
          />
        </label>

        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d]">
          <select
            value={directionValue}
            onChange={(event) => {
              const next = event.target.value as SupplierListBalanceDirection;
              setDirectionValue(next);
              applyFilters({ direction: next });
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="all">Tüm Cari Yönleri</option>
            <option value="PAYABLE">Borçlu (Borç)</option>
            <option value="RECEIVABLE">Alacaklı</option>
            <option value="SETTLED">Hesap Kapalı</option>
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 text-slate-400"
          />
        </label>

        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d]">
          <select
            value={statusValue}
            onChange={(event) => {
              const next = event.target.value as "all" | "active" | "passive";
              setStatusValue(next);
              applyFilters({ status: next });
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 text-slate-400"
          />
        </label>

        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d]">
          <select
            value={roleValue}
            onChange={(event) => {
              const next = event.target.value as "all" | "with" | "without";
              setRoleValue(next);
              applyFilters({ role: next });
            }}
            className="cursor-pointer appearance-none bg-transparent pr-5 outline-none"
          >
            <option value="all">Müşteri Rolü (Tümü)</option>
            <option value="with">Müşteri Rolü Var</option>
            <option value="without">Müşteri Rolü Yok</option>
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 text-slate-400"
          />
        </label>

        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#0f1f4d]">
          <span className="shrink-0 text-slate-500">Son hareket</span>
          <input
            type="date"
            value={activityFromValue}
            onChange={(event) => {
              const next = event.target.value;
              setActivityFromValue(next);
              applyFilters({ activityFrom: next });
            }}
            className="bg-transparent outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Filter size={16} />
          {isPending ? "Filtreleniyor..." : "Filtrele"}
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        <Link
          href="/suppliers/new"
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 px-4 text-[12px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95"
        >
          <Plus size={16} strokeWidth={3} />
          Tedarikçi Ekle
        </Link>
      </form>
    </div>
  );
}

export function SuppliersTablePagination({
  activeTab,
  activeCategory,
  searchQuery,
  totalPages,
  currentPage,
  totalRecords,
  favoriteOnly,
  balanceDirection,
  customerRole,
  lastActivityFrom,
  statusFilter,
}: Pick<
  SuppliersTableControlsProps,
  | "activeTab"
  | "activeCategory"
  | "searchQuery"
  | "totalPages"
  | "currentPage"
  | "totalRecords"
  | "favoriteOnly"
  | "balanceDirection"
  | "customerRole"
  | "lastActivityFrom"
  | "statusFilter"
>) {
  const queryBase = {
    category: activeCategory,
    q: searchQuery,
    favorite: favoriteOnly,
    balanceDirection,
    customerRole,
    lastActivityFrom,
    status: statusFilter,
  };
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    0,
    5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Toplam {totalRecords} tedarikçi
        {searchQuery ? (
          <span className="text-slate-400"> · &quot;{searchQuery}&quot; araması</span>
        ) : null}
        {activeCategory ? (
          <span className="text-slate-400"> · {activeCategory}</span>
        ) : null}
        {favoriteOnly ? <span className="text-slate-400"> · Favoriler</span> : null}
      </p>

      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildSuppliersQuery({
              tab: activeTab,
              page: currentPage - 1,
              ...queryBase,
            })}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-[#24345f] transition hover:bg-slate-50"
          >
            Önceki
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-slate-300">
            Önceki
          </span>
        )}

        {pageNumbers.map((page) => (
          <Link
            key={page}
            href={buildSuppliersQuery({
              tab: activeTab,
              page,
              ...queryBase,
            })}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-black leading-none",
              page === currentPage
                ? "bg-[#0f1f4d] text-white"
                : "border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50",
            ].join(" ")}
          >
            {page}
          </Link>
        ))}

        {currentPage < totalPages ? (
          <Link
            href={buildSuppliersQuery({
              tab: activeTab,
              page: currentPage + 1,
              ...queryBase,
            })}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-[#24345f] transition hover:bg-slate-50"
          >
            Sonraki
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold leading-none text-slate-300">
            Sonraki
          </span>
        )}
      </div>
    </div>
  );
}
