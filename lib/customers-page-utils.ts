import { getGroupBadgeClass } from "@/lib/customer-group-utils";

export type CustomerTabKey =
  | "all"
  | "active"
  | "passive"
  | "debtors"
  | "receivables";

export type CustomerTableRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  taxOffice: string | null;
  group: string;
  groupColor: string | null;
  balance: number;
  status: string;
  avatarColorClass: string;
};

export type CustomerStatCard = {
  title: string;
  value: string;
  subtitle: string;
  secondSubtitle?: string;
  iconKey: "users" | "wallet" | "check" | "bell" | "userPlus";
  color: "emerald" | "rose" | "orange" | "blue";
};

export const CUSTOMER_TAB_LABELS: Record<CustomerTabKey, string> = {
  all: "Tümü",
  active: "Aktif",
  passive: "Pasif",
  debtors: "Borçlu",
  receivables: "Alacaklı",
};

export function parseCustomerTab(value?: string | null): CustomerTabKey {
  if (
    value === "active" ||
    value === "passive" ||
    value === "debtors" ||
    value === "receivables"
  ) {
    return value;
  }

  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseGroupFilter(value?: string | null) {
  if (!value || value === "all") return null;
  return decodeURIComponent(value);
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildCustomersQuery(params: {
  tab?: CustomerTabKey;
  page?: number;
  group?: string | null;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.group) {
    search.set("group", params.group);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/customers?${query}` : "/customers";
}

export function buildCustomersExportQuery(params: {
  tab?: CustomerTabKey;
  group?: string | null;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.group) {
    search.set("group", params.group);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/api/customers/export?${query}` : "/api/customers/export";
}

export function buildSingleCustomerExportHref(customerId: string) {
  return `/api/customers/${customerId}/export`;
}

export const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-purple-500",
];

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getGroupBadge(group?: string | null, color?: string | null) {
  return getGroupBadgeClass(group, color);
}

export function getBalanceStatus(balance: number) {
  if (balance > 0) {
    return {
      label: "Borçlu",
      amountClass: "text-rose-500",
      subLabel: "Borçlu",
    };
  }

  if (balance < 0) {
    return {
      label: "Alacaklı",
      amountClass: "text-emerald-600",
      subLabel: "Alacaklı",
    };
  }

  return {
    label: "Borç Yok",
    amountClass: "text-[#0f1f4d]",
    subLabel: "Borç Yok",
  };
}

export function getCustomerStatusBadge(status: string) {
  if (status === "ACTIVE") {
    return {
      label: "Aktif",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "SUSPENDED") {
    return {
      label: "Askıda",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Pasif",
    className: "bg-slate-100 text-slate-600",
  };
}

export { formatMoney as formatCustomerMoney } from "@/lib/format-utils";
