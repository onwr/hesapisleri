import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CreditCard,
  LayoutGrid,
  Percent,
  Sparkles,
} from "lucide-react";
import type { PosQuickFilter } from "@/lib/pos-page-utils";
import { formatMoney } from "@/lib/format-utils";

export type PosQuickActionKey =
  | "barcode"
  | "stock"
  | "service"
  | "discount"
  | "payment";

export type PosQuickActionCard = {
  key: PosQuickActionKey;
  title: string;
  description: string;
  gradient: string;
  icon: LucideIcon;
};

export type PosFilterChipConfig = {
  key: PosQuickFilter;
  label: string;
  icon: LucideIcon;
  activeClass: string;
  idleClass: string;
};

export type PosSummaryMetric = {
  key: string;
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color: "indigo" | "emerald" | "orange" | "rose" | "cyan" | "violet";
};

const metricColorMap = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-500",
  cyan: "bg-cyan-50 text-cyan-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

export function getPosMetricColorClass(color: PosSummaryMetric["color"]) {
  return metricColorMap[color];
}

export function buildPosQuickActionCards(): PosQuickActionCard[] {
  return [
    {
      key: "barcode",
      title: "Barkodlu Satış",
      description: "Barkod okutarak hızlı ekle",
      gradient: "bg-linear-to-br from-indigo-500 to-violet-600",
      icon: Barcode,
    },
    {
      key: "stock",
      title: "Ürün Seç",
      description: "Stoklu ürünleri sepete ekle",
      gradient: "bg-linear-to-br from-emerald-500 to-teal-500",
      icon: Boxes,
    },
    {
      key: "service",
      title: "Hizmet Seç",
      description: "Stoksuz hizmet kalemi ekle",
      gradient: "bg-linear-to-br from-cyan-500 to-blue-500",
      icon: Sparkles,
    },
    {
      key: "discount",
      title: "İndirimli Satış",
      description: "Sepet indirimi uygula",
      gradient: "bg-linear-to-br from-rose-500 to-pink-500",
      icon: Percent,
    },
    {
      key: "payment",
      title: "Nakit / Kart",
      description: "Ödemeyi hızlı tamamla",
      gradient: "bg-linear-to-br from-orange-500 to-amber-500",
      icon: CreditCard,
    },
  ];
}

export function buildPosFilterChips(): PosFilterChipConfig[] {
  return [
    {
      key: "all",
      label: "Tümü",
      icon: LayoutGrid,
      activeClass: "bg-slate-800 text-white shadow-sm",
      idleClass:
        "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
    },
    {
      key: "stock",
      label: "Stoklu Ürünler",
      icon: Boxes,
      activeClass: "bg-emerald-600 text-white shadow-sm",
      idleClass:
        "border border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50",
    },
    {
      key: "service",
      label: "Hizmetler",
      icon: Sparkles,
      activeClass: "bg-cyan-600 text-white shadow-sm",
      idleClass:
        "border border-cyan-100 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-50",
    },
    {
      key: "low_stock",
      label: "Düşük Stok",
      icon: AlertTriangle,
      activeClass: "bg-rose-600 text-white shadow-sm",
      idleClass:
        "border border-rose-100 bg-rose-50/60 text-rose-700 hover:bg-rose-50",
    },
  ];
}

export function buildPosSummaryMetrics(input: {
  todaySalesCount: number;
  todaySalesTotal: number;
  cartTotal: number;
  cartLineCount: number;
  cartItemCount: number;
}): PosSummaryMetric[] {
  return [
    {
      key: "today-sales",
      label: "Bugünkü Satış",
      value: String(input.todaySalesCount),
      subtitle: formatMoney(input.todaySalesTotal),
      icon: LayoutGrid,
      color: "indigo",
    },
    {
      key: "cart-total",
      label: "Sepet Tutarı",
      value: formatMoney(input.cartTotal),
      subtitle: "Ödenecek tutar",
      icon: CreditCard,
      color: "orange",
    },
    {
      key: "cart-items",
      label: "Sepetteki Kalem",
      value: String(input.cartLineCount),
      subtitle: `${input.cartItemCount} adet`,
      icon: Boxes,
      color: "emerald",
    },
  ];
}
