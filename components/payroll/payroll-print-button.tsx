"use client";

import { Printer } from "lucide-react";

export function PayrollPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white print:hidden"
    >
      <Printer className="h-4 w-4" />
      Yazdır
    </button>
  );
}
