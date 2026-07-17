"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

type SaleReturnReceiptActionsProps = {
  saleId: string;
};

export function SaleReturnReceiptActions({
  saleId,
}: SaleReturnReceiptActionsProps) {
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        data-testid="return-receipt-print-button"
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
    </div>
  );
}
