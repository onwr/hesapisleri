import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Banknote,
  BookUser,
  Box,
  Brain,
  FileText,
  Home,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import {
  canAccessModule,
  canManageSettings,
  type AppModule,
  type PermissionRole,
} from "@/lib/permission-utils";

export type SidebarMenuItem = {
  type: "link";
  title: string;
  href: string;
  icon: LucideIcon;
  module: AppModule;
  badge?: string;
};

export type SidebarSubMenuItem = {
  title: string;
  href: string;
  module?: AppModule;
  canAccess?: (role: PermissionRole, isOwner: boolean) => boolean;
};

export type SidebarMenuGroup = {
  type: "group";
  id: "ecommerce";
  title: string;
  icon: LucideIcon;
  items: SidebarSubMenuItem[];
};

export type SidebarNavEntry = SidebarMenuItem | SidebarMenuGroup;

const SIDEBAR_LINK_ITEMS: Omit<SidebarMenuItem, "type">[] = [
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
  { title: "Tedarikçiler", href: "/suppliers", icon: Truck, module: "suppliers" },
  {
    title: "Fihrist",
    href: "/directory",
    icon: BookUser,
    module: "directory",
  },
  { title: "Ürünler", href: "/products", icon: Box, module: "products" },
  { title: "Faturalar", href: "/invoices", icon: FileText, module: "invoices" },
  {
    title: "Kasa & Banka",
    href: "/cash-bank",
    icon: Banknote,
    module: "cash-bank",
  },
  { title: "Giderler", href: "/expenses", icon: ReceiptText, module: "expenses" },
  { title: "Raporlar", href: "/reports", icon: BarChart3, module: "reports" },
  {
    title: "AI Asistan",
    href: "/ai-assistant",
    icon: Brain,
    module: "ai-assistant",
  },
  {
    title: "Çalışanlar",
    href: "/team",
    icon: UserCog,
    module: "employees",
  },
  { title: "Ayarlar", href: "/settings", icon: Settings, module: "settings" },
];

export const SIDEBAR_ECOMMERCE_GROUP = {
  id: "ecommerce" as const,
  title: "E-Ticaret",
  icon: Store,
  items: [
    {
      title: "Siparişler",
      href: "/orders",
      module: "orders" as AppModule,
    },
    {
      title: "Pazaryeri Entegrasyonları",
      href: "/settings/integrations",
      canAccess: canManageSettings,
    },
  ] satisfies SidebarSubMenuItem[],
};

/** @deprecated Use getSidebarNavItems for grouped navigation. */
export const SIDEBAR_MENU_ITEMS = SIDEBAR_LINK_ITEMS;

function canAccessSubMenuItem(
  item: SidebarSubMenuItem,
  role: PermissionRole,
  isOwner: boolean
) {
  if (item.canAccess) {
    return item.canAccess(role, isOwner);
  }

  if (item.module) {
    return canAccessModule(role, item.module, isOwner);
  }

  return true;
}

function getVisibleEcommerceGroup(
  role: PermissionRole,
  isOwner: boolean
): SidebarMenuGroup | null {
  const items = SIDEBAR_ECOMMERCE_GROUP.items.filter((item) =>
    canAccessSubMenuItem(item, role, isOwner)
  );

  if (items.length === 0) {
    return null;
  }

  return {
    type: "group",
    ...SIDEBAR_ECOMMERCE_GROUP,
    items,
  };
}

export function isSidebarSubMenuItemActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

export function isEcommerceSidebarPath(pathname: string) {
  return SIDEBAR_ECOMMERCE_GROUP.items.some((item) =>
    isSidebarSubMenuItemActive(pathname, item.href)
  );
}

export function getSidebarNavItems(
  role: PermissionRole,
  isOwner = false
): SidebarNavEntry[] {
  const items: SidebarNavEntry[] = SIDEBAR_LINK_ITEMS.filter((item) =>
    canAccessModule(role, item.module, isOwner)
  ).map((item) => ({ type: "link", ...item }));

  const ecommerceGroup = getVisibleEcommerceGroup(role, isOwner);
  if (!ecommerceGroup) {
    return items;
  }

  const expensesIndex = items.findIndex(
    (item) => item.type === "link" && item.href === "/expenses"
  );
  const insertAt = expensesIndex >= 0 ? expensesIndex + 1 : items.length;
  items.splice(insertAt, 0, ecommerceGroup);

  return items;
}

export function getSidebarMenuItems(role: PermissionRole, isOwner = false) {
  return SIDEBAR_LINK_ITEMS.filter((item) =>
    canAccessModule(role, item.module, isOwner)
  );
}

export function getSidebarVisibleLinkTitles(
  role: PermissionRole,
  isOwner = false
) {
  return getSidebarNavItems(role, isOwner).flatMap((entry) => {
    if (entry.type === "group") {
      return entry.items.map((item) => item.title);
    }

    return [entry.title];
  });
}

export function getSidebarVisibleHrefs(role: PermissionRole, isOwner = false) {
  return getSidebarNavItems(role, isOwner).flatMap((entry) => {
    if (entry.type === "group") {
      return entry.items.map((item) => item.href);
    }

    return [entry.href];
  });
}
