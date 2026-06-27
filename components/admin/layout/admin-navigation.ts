import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Boxes,
  Building2,
  Calculator,
  Clock3,
  CreditCard,
  Handshake,
  LayoutDashboard,
  Logs,
  Megaphone,
  Package,
  ScrollText,
  Settings,
  Settings2,
  TicketPercent,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";

export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  enabled?: boolean;
  badge?: string;
  /** Parent stays active when pathname matches this prefix (defaults to href) */
  activePrefix?: string;
  /** Exact match only — no child route activation */
  exact?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "general",
    label: "Genel",
    items: [
      {
        id: "overview",
        label: "Genel Bakış",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        id: "companies",
        label: "Firmalar",
        href: "/admin/companies",
        icon: Building2,
        activePrefix: "/admin/companies",
      },
      {
        id: "users",
        label: "Kullanıcılar",
        href: "/admin/users",
        icon: Users,
        activePrefix: "/admin/users",
      },
      {
        id: "subscriptions",
        label: "Abonelikler",
        href: "/admin/subscriptions",
        icon: BadgeCheck,
        activePrefix: "/admin/subscriptions",
      },
    ],
  },
  {
    id: "revenue",
    label: "Gelir ve Üyelik",
    items: [
      {
        id: "payments",
        label: "Ödemeler",
        href: "/admin/payments",
        icon: CreditCard,
        activePrefix: "/admin/payments",
      },
      {
        id: "price-preview",
        label: "Fiyat Önizleme",
        href: "/admin/price-preview",
        icon: Calculator,
        activePrefix: "/admin/price-preview",
      },
      {
        id: "membership-plans",
        label: "Üyelik Planları",
        href: "/admin/plans",
        icon: Package,
        activePrefix: "/admin/plans",
      },
      {
        id: "membership-campaigns",
        label: "Kampanyalar",
        href: "/admin/campaigns",
        icon: Megaphone,
        activePrefix: "/admin/campaigns",
      },
      {
        id: "membership-coupons",
        label: "Kuponlar",
        href: "/admin/coupons",
        icon: TicketPercent,
        activePrefix: "/admin/coupons",
      },
      {
        id: "membership-addons",
        label: "Ek Paketler",
        href: "/admin/add-ons",
        icon: Boxes,
        activePrefix: "/admin/add-ons",
      },
    ],
  },
  {
    id: "partners",
    label: "Ortaklık Programı",
    items: [
      {
        id: "partners",
        label: "Partnerler",
        href: "/admin/partners",
        icon: Handshake,
        activePrefix: "/admin/partners",
        exact: true,
      },
      {
        id: "partner-applications",
        label: "Başvurular",
        href: "/admin/partners/applications",
        icon: UserCheck,
        activePrefix: "/admin/partners/applications",
      },
      {
        id: "partner-payouts",
        label: "Partner Ödemeleri",
        href: "/admin/partners/payouts",
        icon: WalletCards,
        activePrefix: "/admin/partners/payouts",
      },
      {
        id: "partner-settings",
        label: "Partner Ayarları",
        href: "/admin/partners/settings",
        icon: Settings2,
        activePrefix: "/admin/partners/settings",
      },
    ],
  },
  {
    id: "system",
    label: "Sistem",
    items: [
      {
        id: "logs",
        label: "Sistem Logları",
        href: "/admin/system-logs",
        icon: ScrollText,
        activePrefix: "/admin/system-logs",
      },
      {
        id: "jobs",
        label: "Cron ve İş Kuyrukları",
        href: "/admin/jobs",
        icon: Clock3,
        activePrefix: "/admin/jobs",
      },
      {
        id: "platform-settings",
        label: "Platform Ayarları",
        href: "/admin/platform-settings",
        icon: Settings,
        activePrefix: "/admin/platform-settings",
      },
    ],
  },
];

export const ADMIN_ROUTE_LABELS: Record<string, string> = {
  admin: "Platform Yönetimi",
  companies: "Firmalar",
  users: "Kullanıcılar",
  subscriptions: "Abonelikler",
  payments: "Ödemeler",
  "membership-plans": "Üyelik Planları",
  preview: "Fiyat Önizleme",
  campaigns: "Kampanyalar",
  "membership-coupons": "Kuponlar",
  "membership-addons": "Ek Paketler",
  partners: "Partnerler",
  applications: "Başvurular",
  payouts: "Partner Ödemeleri",
  settings: "Ayarlar",
  logs: "Sistem Logları",
  "system-logs": "Sistem Logları",
  "system-health": "Sistem Sağlığı",
  jobs: "Cron ve İş Kuyrukları",
  "platform-settings": "Platform Ayarları",
};

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  if (item.enabled === false) return false;

  if (item.exact) {
    return pathname === item.href;
  }

  const prefix = item.activePrefix ?? item.href;

  if (prefix === "/admin/partners") {
    return (
      pathname === "/admin/partners" ||
      (pathname.startsWith("/admin/partners/") &&
        !pathname.startsWith("/admin/partners/applications") &&
        !pathname.startsWith("/admin/partners/payouts") &&
        !pathname.startsWith("/admin/partners/settings"))
    );
  }

  if (pathname === prefix) return true;
  return pathname.startsWith(`${prefix}/`);
}

export function flattenAdminNavItems() {
  return ADMIN_NAV_GROUPS.flatMap((group) => group.items);
}
