"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { WarehouseCreateModal } from "@/components/stocks/warehouse-create-modal";

export function WarehousesPageHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/stocks"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#0f1f4d]">Depolar</h1>
              <p className="mt-1 text-sm text-slate-500">
                Depo, raf ve stok dağılımınızı yönetin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
          >
            <Plus size={16} />
            Yeni Depo
          </button>
        </div>
      </section>
      <WarehouseCreateModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
