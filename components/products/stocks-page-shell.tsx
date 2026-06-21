"use client";

import type { ReactNode } from "react";
import { ProductsSubNav } from "@/components/products/products-sub-nav";

type StocksPageShellProps = {
  children: ReactNode;
};

export function StocksPageShell({ children }: StocksPageShellProps) {
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
          Stok Hareketleri
        </h1>
        <p className="text-[12px] font-medium text-slate-500">
          Ürün giriş, çıkış, transfer ve stok düzeltme işlemlerinizi takip edin.
        </p>
      </div>

      <ProductsSubNav />

      {children}
    </div>
  );
}
