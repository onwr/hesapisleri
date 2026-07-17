"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

type PrintSaleButtonProps = {
  saleId?: string;
};

export function PrintSaleButton({ saleId }: PrintSaleButtonProps) {
  if (saleId) {
    return (
      <Link
        href={`/sales/${saleId}/receipt`}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 print:hidden"
      >
        <Printer size={20} />
        Fiş Yazdır
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 print:hidden"
    >
      <Printer size={20} />
      Fiş Yazdır
    </button>
  );
}
