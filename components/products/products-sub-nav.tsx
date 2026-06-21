"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Link2, Package, Warehouse } from "lucide-react";
import { PRODUCTS_STOCKS_WAREHOUSES_PATH } from "@/lib/stocks-page-utils";

const tabs = [
  {
    href: "/products",
    label: "Ürün Listesi",
    icon: Package,
    exact: true,
  },
  {
    href: "/products/stocks",
    label: "Stok Hareketleri",
    icon: Boxes,
    exact: false,
  },
  {
    href: PRODUCTS_STOCKS_WAREHOUSES_PATH,
    label: "Depolar",
    icon: Warehouse,
    exact: false,
  },
  {
    href: "/products/channel-mapping",
    label: "SKU Eşlemeleri",
    icon: Link2,
    exact: false,
  },
] as const;

export function ProductsSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ürünler alt menü"
      className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/products/stocks"
            ? pathname === "/products/stocks"
            : tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-extrabold transition",
              active
                ? "bg-[#0f1f4d] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-[#0f1f4d]",
            ].join(" ")}
          >
            <Icon size={13} strokeWidth={2.4} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
