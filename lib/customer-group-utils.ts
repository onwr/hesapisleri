export const DEFAULT_GROUP_NAME = "Genel";

export const CUSTOMER_GROUP_COLORS = [
  "slate",
  "blue",
  "emerald",
  "violet",
  "orange",
  "rose",
  "cyan",
] as const;

export type CustomerGroupColor = (typeof CUSTOMER_GROUP_COLORS)[number];

export const DEFAULT_CUSTOMER_GROUPS: Array<{
  name: string;
  color: CustomerGroupColor;
  sortOrder: number;
}> = [
  { name: "Genel", color: "slate", sortOrder: 0 },
  { name: "Perakende", color: "blue", sortOrder: 1 },
  { name: "Toptan", color: "emerald", sortOrder: 2 },
  { name: "Kurumsal", color: "violet", sortOrder: 3 },
];

const COLOR_CLASS_MAP: Record<CustomerGroupColor, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

export function normalizeGroupName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_GROUP_NAME;
}

export function getDefaultGroupColor(name: string): CustomerGroupColor {
  const value = name.toLocaleLowerCase("tr-TR");

  if (value.includes("toptan")) return "emerald";
  if (value.includes("perakende")) return "blue";
  if (value.includes("kurumsal")) return "violet";
  if (value.includes("genel")) return "slate";

  return "blue";
}

export function getGroupColorClass(color?: string | null) {
  if (color && color in COLOR_CLASS_MAP) {
    return COLOR_CLASS_MAP[color as CustomerGroupColor];
  }

  return COLOR_CLASS_MAP.blue;
}

export function getGroupBadgeClass(group?: string | null, color?: string | null) {
  if (color) {
    return getGroupColorClass(color);
  }

  return getGroupColorClass(getDefaultGroupColor(normalizeGroupName(group)));
}

export function isDefaultGroupName(name: string) {
  return normalizeGroupName(name) === DEFAULT_GROUP_NAME;
}
