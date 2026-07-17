"use client";

import Link from "next/link";
import { ArrowLeft, Printer, ShoppingCart } from "lucide-react";

type SaleReceiptActionsProps = {
  saleId: string;
};

export function SaleReceiptActions({ saleId }: SaleReceiptActionsProps) {
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        data-testid="receipt-print-button"
        onClick={() => window.print()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
      >
        <Printer size={16} />
        Yazdır
      </button>
      <Link
        href={`/sales/${saleId}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Satışa Dön
      </Link>
      <Link
        href="/pos"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-emerald-700"
      >
        <ShoppingCart size={16} />
        Yeni Satış
      </Link>
    </div>
  );
}
