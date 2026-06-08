"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-slate-700 transition hover:bg-slate-50 print:hidden"
    >
      <Printer size={16} />
      PDF / Yazdır
    </button>
  );
}
