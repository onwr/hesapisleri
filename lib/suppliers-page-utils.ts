import {
  formatSupplierMoney,
  getSupplierDisplayName,
  getSupplierPrimaryLine,
  parseSupplierCustomerRoleFilter,
  parseSupplierLastActivityFrom,
  parseSupplierListBalanceDirection,
  type SupplierListBalanceDirection,
} from "@/lib/supplier-utils";
import type { SupplierRow } from "@/lib/supplier-utils";

export type SupplierTabKey = "all" | "active" | "passive" | "payable" | "overdue";

export type SupplierTableRow = {
  id: string;
  name: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  category: string | null;
  city: string | null;
  balance: number;
  payableAmount: number;
  receivableAmount: number;
  netStatusLabel: string;
  totalPurchases: number;
  hasCustomerRole: boolean;
  lastActivityAt: Date | null;
  lastActivityType: string | null;
  overdueAmount: number;
  productCount: number;
  isActive: boolean;
  isFavorite: boolean;
  avatarColorClass: string;
  currency: string;
};

export type SupplierStatCard = {
  title: string;
  value: string;
  subtitle: string;
  secondSubtitle?: string;
  iconKey: "truck" | "wallet" | "check" | "bell" | "package";
  color: "emerald" | "rose" | "orange" | "blue";
};

export const SUPPLIER_TAB_LABELS: Record<SupplierTabKey, string> = {
  all: "Tümü",
  active: "Aktif",
  passive: "Pasif",
  payable: "Borçlu",
  overdue: "Vadesi Geçen",
};

export const SUPPLIER_AVATAR_COLORS = [
  "bg-blue-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-purple-500",
];

export function parseSupplierTab(value?: string | null): SupplierTabKey {
  if (
    value === "active" ||
    value === "passive" ||
    value === "payable" ||
    value === "overdue"
  ) {
    return value;
  }
  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseCategoryFilter(value?: string | null) {
  if (!value || value === "all") return null;
  return decodeURIComponent(value);
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseFavoriteFilter(value?: string | null) {
  return value === "1";
}

export function parseSupplierStatusFilter(value?: string | null) {
  if (value === "active" || value === "passive") return value;
  return "all" as const;
}

export {
  parseSupplierCustomerRoleFilter,
  parseSupplierLastActivityFrom,
  parseSupplierListBalanceDirection,
  type SupplierListBalanceDirection,
};

export function buildSuppliersQuery(params: {
  tab?: SupplierTabKey;
  page?: number;
  category?: string | null;
  q?: string | null;
  favorite?: boolean;
  balanceDirection?: SupplierListBalanceDirection;
  customerRole?: ReturnType<typeof parseSupplierCustomerRoleFilter>;
  lastActivityFrom?: string | null;
  status?: ReturnType<typeof parseSupplierStatusFilter>;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.favorite) {
    search.set("favorite", "1");
  }

  if (params.balanceDirection && params.balanceDirection !== "all") {
    search.set("balanceDirection", params.balanceDirection);
  }

  if (params.customerRole && params.customerRole !== "all") {
    search.set("customerRole", params.customerRole);
  }

  if (params.lastActivityFrom) {
    search.set("lastActivityFrom", params.lastActivityFrom);
  }

  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }

  const query = search.toString();
  return query ? `/suppliers?${query}` : "/suppliers";
}

export function buildSuppliersExportQuery(params: {
  tab?: SupplierTabKey;
  category?: string | null;
  q?: string | null;
  favorite?: boolean;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.favorite) {
    search.set("favorite", "1");
  }

  const query = search.toString();
  return query ? `/api/suppliers/export?${query}` : "/api/suppliers/export";
}

export function buildSuppliersLedgerExportQuery(params: {
  supplierId?: string | null;
  from?: string | null;
  to?: string | null;
  type?: string | null;
  accountId?: string | null;
  balanceDirection?: SupplierListBalanceDirection;
}) {
  const search = new URLSearchParams();

  if (params.supplierId) search.set("supplierId", params.supplierId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.accountId) search.set("accountId", params.accountId);
  if (params.balanceDirection && params.balanceDirection !== "all") {
    search.set("balanceDirection", params.balanceDirection);
  }

  const query = search.toString();
  return query
    ? `/api/suppliers/ledger-export?${query}`
    : "/api/suppliers/ledger-export";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getSupplierBalanceStatus(balance: number) {
  if (balance > 0) {
    return {
      label: "Tedarikçiye Borcumuz",
      amountClass: "text-rose-500",
      subLabel: "Borç",
      payableAmount: balance,
      receivableAmount: 0,
    };
  }

  if (balance < 0) {
    return {
      label: "Tedarikçiden Alacağımız",
      amountClass: "text-emerald-600",
      subLabel: "Alacak",
      payableAmount: 0,
      receivableAmount: Math.abs(balance),
    };
  }

  return {
    label: "Hesap Kapalı",
    amountClass: "text-[#0f1f4d]",
    subLabel: "Kapalı",
    payableAmount: 0,
    receivableAmount: 0,
  };
}

export function getSupplierStatusBadge(isActive: boolean) {
  if (isActive) {
    return {
      label: "Aktif",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Pasif",
    className: "bg-slate-100 text-slate-600",
  };
}

export function getCategoryBadge(category?: string | null) {
  if (!category) {
    return "bg-slate-100 text-slate-600";
  }

  const palette: Record<string, string> = {
    Hammadde: "bg-blue-50 text-blue-700",
    Ambalaj: "bg-violet-50 text-violet-700",
    Lojistik: "bg-orange-50 text-orange-700",
    Hizmet: "bg-emerald-50 text-emerald-700",
    Yazılım: "bg-sky-50 text-sky-700",
    Diğer: "bg-slate-100 text-slate-600",
  };

  return palette[category] ?? "bg-slate-100 text-slate-700";
}

export function toSupplierTableRow(row: SupplierRow, index: number): SupplierTableRow {
  return {
    id: row.id,
    name: getSupplierPrimaryLine(row),
    companyName: row.companyName,
    contactName: row.contactName,
    phone: row.phone ?? row.mobilePhone,
    email: row.email,
    taxNumber: row.taxNumber,
    category: row.category,
    city: row.city,
    balance: row.currentBalance,
    payableAmount: row.payableAmount,
    receivableAmount: row.receivableAmount,
    netStatusLabel: row.netStatusLabel,
    totalPurchases: row.totalPurchases,
    hasCustomerRole: row.hasCustomerRole,
    lastActivityAt: row.lastActivityAt,
    lastActivityType: row.lastActivityType,
    overdueAmount: row.overdueAmount,
    productCount: row.productCount,
    isActive: row.isActive,
    isFavorite: row.isFavorite,
    avatarColorClass: SUPPLIER_AVATAR_COLORS[index % SUPPLIER_AVATAR_COLORS.length],
    currency: row.currency,
  };
}

export { formatSupplierMoney, getSupplierDisplayName };
