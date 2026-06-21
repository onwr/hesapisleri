"use client";

import { ArrowLeftRight, Plus } from "lucide-react";
import { ProductsSubNav } from "@/components/products/products-sub-nav";

type WarehousesPageHeaderProps = {
  canManage: boolean;
  onCreate: () => void;
  onTransfer: () => void;
};

export function WarehousesPageHeader({
  canManage,
  onCreate,
  onTransfer,
}: WarehousesPageHeaderProps) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Depolar
          </h1>
          <p className="text-[12px] font-medium text-slate-500">
            Depolarınızı, stok durumlarını ve transfer işlemlerini yönetin.
          </p>
        </div>

        {canManage ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onTransfer}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50 sm:w-auto"
            >
              <ArrowLeftRight size={14} />
              <span className="sm:hidden">Depolar Arası Transfer</span>
              <span className="hidden sm:inline">Transfer Yap</span>
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white transition hover:bg-[#162a5c] sm:w-auto"
            >
              <Plus size={14} />
              Yeni Depo
            </button>
          </div>
        ) : null}
      </div>

      <ProductsSubNav />
    </>
  );
}
