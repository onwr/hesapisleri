export type DashboardShortcutIconKey =
  | "users"
  | "package"
  | "file-text"
  | "box"
  | "credit-card"
  | "trending-up"
  | "shopping-cart"
  | "receipt-text"
  | "wallet"
  | "scan-barcode"
  | "banknote"
  | "bar-chart"
  | "calendar"
  | "truck"
  | "settings"
  | "brain"
  | "store";

export type DashboardShortcutDefinition = {
  id: string;
  label: string;
  href: string;
  icon: DashboardShortcutIconKey;
};

export const DASHBOARD_SHORTCUT_LIMIT = 6;

export const DASHBOARD_SHORTCUT_CATALOG: DashboardShortcutDefinition[] = [
  {
    id: "customers-new",
    label: "Yeni Müşteri",
    href: "/customers/new",
    icon: "users",
  },
  {
    id: "customers",
    label: "Cari Hesaplar",
    href: "/customers",
    icon: "credit-card",
  },
  {
    id: "products",
    label: "Ürün Listesi",
    href: "/products",
    icon: "package",
  },
  {
    id: "products-new",
    label: "Yeni Ürün",
    href: "/products/new",
    icon: "package",
  },
  {
    id: "products-stocks",
    label: "Stok Durumu",
    href: "/products/stocks",
    icon: "box",
  },
  {
    id: "invoices",
    label: "Fatura Listesi",
    href: "/invoices",
    icon: "file-text",
  },
  {
    id: "invoices-new",
    label: "Fatura Kes",
    href: "/invoices/e-invoice",
    icon: "file-text",
  },
  {
    id: "sales-new",
    label: "Yeni Satış",
    href: "/sales/new",
    icon: "shopping-cart",
  },
  {
    id: "sales",
    label: "Satışlar",
    href: "/sales",
    icon: "shopping-cart",
  },
  {
    id: "pos",
    label: "POS / Hızlı Satış",
    href: "/pos",
    icon: "scan-barcode",
  },
  {
    id: "cash-bank",
    label: "Kasa & Banka",
    href: "/cash-bank",
    icon: "banknote",
  },
  {
    id: "collections",
    label: "Tahsilat Al",
    href: "/cash-bank/collections",
    icon: "wallet",
  },
  {
    id: "expenses-new",
    label: "Gider Ekle",
    href: "/expenses/new",
    icon: "receipt-text",
  },
  {
    id: "expenses",
    label: "Giderler",
    href: "/expenses",
    icon: "receipt-text",
  },
  {
    id: "reports",
    label: "Raporlar",
    href: "/reports",
    icon: "bar-chart",
  },
  {
    id: "calendar",
    label: "Takvim",
    href: "/calendar",
    icon: "calendar",
  },
  {
    id: "suppliers",
    label: "Tedarikçiler",
    href: "/suppliers",
    icon: "truck",
  },
  {
    id: "orders",
    label: "Siparişler",
    href: "/orders",
    icon: "store",
  },
  {
    id: "ai-assistant",
    label: "AI Asistan",
    href: "/ai-assistant",
    icon: "brain",
  },
  {
    id: "settings",
    label: "Ayarlar",
    href: "/settings",
    icon: "settings",
  },
];

export const DEFAULT_DASHBOARD_SHORTCUT_IDS = [
  "customers-new",
  "products",
  "invoices",
  "products-stocks",
  "customers",
  "cash-bank",
] as const;

const catalogById = new Map(
  DASHBOARD_SHORTCUT_CATALOG.map((item) => [item.id, item])
);

export function getDashboardShortcutStorageKey(
  userId: string,
  companyId: string
) {
  return `hesapisleri_dashboard_shortcuts_${companyId}_${userId}`;
}

export function normalizeDashboardShortcutIds(
  value: unknown,
  limit = DASHBOARD_SHORTCUT_LIMIT
): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_DASHBOARD_SHORTCUT_IDS];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if (!catalogById.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    normalized.push(entry);
    if (normalized.length >= limit) break;
  }

  if (normalized.length === 0) {
    return [...DEFAULT_DASHBOARD_SHORTCUT_IDS];
  }

  while (normalized.length < limit) {
    const fallback = DEFAULT_DASHBOARD_SHORTCUT_IDS.find(
      (id) => !normalized.includes(id)
    );
    if (!fallback) break;
    normalized.push(fallback);
  }

  return normalized.slice(0, limit);
}

export function resolveDashboardShortcuts(ids: string[]) {
  return normalizeDashboardShortcutIds(ids).map((id) => {
    const item = catalogById.get(id);
    if (!item) {
      return DASHBOARD_SHORTCUT_CATALOG[0];
    }
    return item;
  });
}

export function loadDashboardShortcutIds(
  userId: string,
  companyId: string
): string[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(
      getDashboardShortcutStorageKey(userId, companyId)
    );
    if (!raw) return null;
    return normalizeDashboardShortcutIds(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDashboardShortcutIds(
  userId: string,
  companyId: string,
  ids: string[]
) {
  if (typeof window === "undefined") return;

  const normalized = normalizeDashboardShortcutIds(ids);
  localStorage.setItem(
    getDashboardShortcutStorageKey(userId, companyId),
    JSON.stringify(normalized)
  );
}
