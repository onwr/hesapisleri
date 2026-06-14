import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Banknote,
  Bell,
  BookUser,
  Box,
  Brain,
  CalendarDays,
  FileText,
  Home,
  Package,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
} from "lucide-react";
import {
  canAccessModule,
  type AppModule,
  type PermissionRole,
} from "@/lib/permission-utils";

export type SidebarMenuItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  module: AppModule;
  badge?: string;
};

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: Home, module: "dashboard" },
  {
    title: "POS / Hızlı Satış",
    href: "/pos",
    icon: ScanBarcode,
    module: "pos",
    badge: "Yeni",
  },
  {
    title: "Satışlar",
    href: "/sales",
    icon: ShoppingCart,
    module: "sales",
  },
  { title: "Müşteriler", href: "/customers", icon: Users, module: "customers" },
  {
    title: "Fihrist",
    href: "/directory",
    icon: BookUser,
    module: "directory",
  },
  { title: "Ürünler", href: "/products", icon: Box, module: "products" },
  { title: "Stoklar", href: "/stocks", icon: Package, module: "stocks" },
  { title: "Faturalar", href: "/invoices", icon: FileText, module: "invoices" },
  {
    title: "Kasa & Banka",
    href: "/cash-bank",
    icon: Banknote,
    module: "cash-bank",
  },
  { title: "Giderler", href: "/expenses", icon: ReceiptText, module: "expenses" },
  {
    title: "Siparişler",
    href: "/orders",
    icon: ShoppingCart,
    module: "orders",
  },
  { title: "Raporlar", href: "/reports", icon: BarChart3, module: "reports" },
  {
    title: "AI Asistan",
    href: "/ai-assistant",
    icon: Brain,
    module: "ai-assistant",
  },
  {
    title: "Bildirimler",
    href: "/notifications",
    icon: Bell,
    module: "notifications",
  },
  {
    title: "Takvim",
    href: "/calendar",
    icon: CalendarDays,
    module: "calendar",
  },
  {
    title: "Çalışanlar",
    href: "/team",
    icon: UserCog,
    module: "employees",
  },
  { title: "Ayarlar", href: "/settings", icon: Settings, module: "settings" },
];

export function getSidebarMenuItems(role: PermissionRole, isOwner = false) {
  return SIDEBAR_MENU_ITEMS.filter((item) =>
    canAccessModule(role, item.module, isOwner)
  );
}
