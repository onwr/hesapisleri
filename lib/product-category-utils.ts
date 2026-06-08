import { DEFAULT_CATEGORY_NAME } from "@/lib/product-form-utils";

export const PRODUCT_CATEGORY_COLORS = [
  "slate",
  "blue",
  "emerald",
  "violet",
  "orange",
  "rose",
  "cyan",
] as const;

export type ProductCategoryColor = (typeof PRODUCT_CATEGORY_COLORS)[number];

export const DEFAULT_PRODUCT_CATEGORIES: Array<{
  name: string;
  color: ProductCategoryColor;
  sortOrder: number;
}> = [{ name: DEFAULT_CATEGORY_NAME, color: "slate", sortOrder: 0 }];

const COLOR_CLASS_MAP: Record<ProductCategoryColor, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

export function normalizeProductCategoryName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_CATEGORY_NAME;
}

export function getDefaultProductCategoryColor(
  name: string
): ProductCategoryColor {
  const value = name.toLocaleLowerCase("tr-TR");

  if (value.includes("hizmet")) return "violet";
  if (value.includes("gıda") || value.includes("gida")) return "emerald";
  if (value.includes("elektronik")) return "blue";
  if (value.includes("genel")) return "slate";

  return "blue";
}

export function getProductCategoryColorClass(color?: string | null) {
  if (color && color in COLOR_CLASS_MAP) {
    return COLOR_CLASS_MAP[color as ProductCategoryColor];
  }

  return COLOR_CLASS_MAP.blue;
}

export function isDefaultProductCategoryName(name: string) {
  return normalizeProductCategoryName(name) === DEFAULT_CATEGORY_NAME;
}
