export const DEFAULT_EXPENSE_CATEGORY_NAME = "Diğer";

export const EXPENSE_CATEGORY_COLORS = [
  "slate",
  "blue",
  "emerald",
  "violet",
  "orange",
  "rose",
  "cyan",
  "amber",
  "indigo",
  "gray",
] as const;

export type ExpenseCategoryColor = (typeof EXPENSE_CATEGORY_COLORS)[number];

export const DEFAULT_EXPENSE_CATEGORY_SEED: Array<{
  name: string;
  color: ExpenseCategoryColor;
  sortOrder: number;
}> = [
  { name: "Kira", color: "violet", sortOrder: 0 },
  { name: "Elektrik", color: "orange", sortOrder: 1 },
  { name: "Su", color: "blue", sortOrder: 2 },
  { name: "İnternet", color: "cyan", sortOrder: 3 },
  { name: "Reklam", color: "rose", sortOrder: 4 },
  { name: "Personel", color: "emerald", sortOrder: 5 },
  { name: "Yakıt", color: "amber", sortOrder: 6 },
  { name: "Kargo", color: "indigo", sortOrder: 7 },
  { name: "Ofis", color: "slate", sortOrder: 8 },
  { name: "Diğer", color: "gray", sortOrder: 9 },
];

const COLOR_CLASS_MAP: Record<ExpenseCategoryColor, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  cyan: "bg-cyan-50 text-cyan-600",
  amber: "bg-amber-50 text-amber-700",
  indigo: "bg-indigo-50 text-indigo-600",
  gray: "bg-gray-100 text-gray-600",
};

export function normalizeExpenseCategoryName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_EXPENSE_CATEGORY_NAME;
}

export function isDefaultExpenseCategoryName(name: string) {
  return name === DEFAULT_EXPENSE_CATEGORY_NAME;
}

export function getDefaultExpenseCategoryColor(name: string): ExpenseCategoryColor {
  const match = DEFAULT_EXPENSE_CATEGORY_SEED.find(
    (category) => category.name === name
  );

  return match?.color ?? "blue";
}

export function getExpenseCategoryColorClass(color?: string | null) {
  const key = (color ?? "blue") as ExpenseCategoryColor;
  return COLOR_CLASS_MAP[key] ?? COLOR_CLASS_MAP.blue;
}

export function getExpenseCategoryBadgeClass(
  categoryName: string,
  colorMap?: Record<string, string | null>
) {
  const color = colorMap?.[categoryName];
  if (color) {
    return getExpenseCategoryColorClass(color);
  }

  const seed = DEFAULT_EXPENSE_CATEGORY_SEED.find(
    (category) => category.name === categoryName
  );

  return getExpenseCategoryColorClass(seed?.color ?? "slate");
}
