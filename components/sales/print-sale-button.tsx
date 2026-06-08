"use client";

import { Printer } from "lucide-react";

export function PrintSaleButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 print:hidden"
    >
      <Printer size={20} />
      Fiş Yazdır
    </button>
  );
}
