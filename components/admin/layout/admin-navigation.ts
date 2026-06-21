import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Boxes,
  Building2,
  Clock3,
  CreditCard,
  Eye,
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
        id: "membership-plans",
        label: "Üyelik Planları",
        href: "/admin/membership-plans",
        icon: Package,
        activePrefix: "/admin/membership-plans",
      },
      {
        id: "membership-campaigns",
        label: "Kampanyalar",
        href: "/admin/membership-campaigns",
        icon: Megaphone,
        activePrefix: "/admin/membership-campaigns",
      },
      {
        id: "membership-coupons",
        label: "Kuponlar",
        href: "/admin/membership-coupons",
        icon: TicketPercent,
        activePrefix: "/admin/membership-coupons",
      },
      {
        id: "membership-addons",
        label: "Ek Paketler",
        href: "/admin/membership-addons",
        icon: Boxes,
        activePrefix: "/admin/membership-addons",
      },
      {
        id: "membership-preview",
        label: "Fiyat Önizleme",
        href: "/admin/membership-plans/preview",
        icon: Eye,
        enabled: false,
        badge: "Yakında",
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
        label: "Sistem Kayıtları",
        href: "/admin/logs",
        icon: ScrollText,
        activePrefix: "/admin/logs",
      },
      {
        id: "system-health",
        label: "Sistem Sağlığı",
        href: "/admin/system-health",
        icon: Activity,
        enabled: false,
        badge: "Yakında",
      },
      {
        id: "jobs",
        label: "Cron ve İş Kuyrukları",
        href: "/admin/jobs",
        icon: Clock3,
        enabled: false,
        badge: "Yakında",
      },
      {
        id: "settings",
        label: "Platform Ayarları",
        href: "/admin/settings",
        icon: Settings,
        enabled: false,
        badge: "Yakında",
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
  "membership-campaigns": "Kampanyalar",
  "membership-coupons": "Kuponlar",
  "membership-addons": "Ek Paketler",
  partners: "Partnerler",
  applications: "Başvurular",
  payouts: "Partner Ödemeleri",
  settings: "Ayarlar",
  logs: "Sistem Kayıtları",
  "system-health": "Sistem Sağlığı",
  jobs: "Cron ve İş Kuyrukları",
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
