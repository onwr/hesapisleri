import { z } from "zod";

export const PRODUCT_UNIT_TYPES = [
  "PIECE",
  "KG",
  "METER",
  "LITER",
  "PACK",
] as const;

export type ProductUnitType = (typeof PRODUCT_UNIT_TYPES)[number];

export const PRODUCT_UNIT_LABELS: Record<ProductUnitType, string> = {
  PIECE: "Adet",
  KG: "Kg",
  METER: "Metre",
  LITER: "Litre",
  PACK: "Paket",
};

export const DEFAULT_CATEGORY_NAME = "Genel";
export const DEFAULT_MIN_STOCK = 10;

export const productFormSchema = z.object({
  name: z.string().min(2, "Ürün adı en az 2 karakter olmalıdır."),
  categoryName: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).default("ACTIVE"),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(DEFAULT_MIN_STOCK),
  unitType: z.enum(PRODUCT_UNIT_TYPES).default("PIECE"),
  warehouseLocation: z.string().optional(),
  buyPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  vatRate: z.number().min(0).default(20),
});

export const productUpdateSchema = productFormSchema.omit({ stock: true });

export type ProductFormInput = z.infer<typeof productFormSchema>;

export type ProductFormValues = {
  name: string;
  categoryName: string;
  sku: string;
  barcode: string;
  description: string;
  imageUrl: string;
  status: "ACTIVE" | "PASSIVE";
  stock: string;
  minStock: string;
  unitType: ProductUnitType;
  warehouseLocation: string;
  buyPrice: string;
  sellPrice: string;
  vatRate: string;
};

export const emptyProductFormValues: ProductFormValues = {
  name: "",
  categoryName: DEFAULT_CATEGORY_NAME,
  sku: "",
  barcode: "",
  description: "",
  imageUrl: "",
  status: "ACTIVE",
  stock: "0",
  minStock: String(DEFAULT_MIN_STOCK),
  unitType: "PIECE",
  warehouseLocation: "",
  buyPrice: "0",
  sellPrice: "0",
  vatRate: "20",
};

export function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeImageUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeCategoryName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_CATEGORY_NAME;
}

export function buildProductPayload(form: ProductFormValues): ProductFormInput {
  return {
    name: form.name.trim(),
    categoryName: normalizeCategoryName(form.categoryName),
    sku: normalizeOptionalText(form.sku) ?? undefined,
    barcode: normalizeOptionalText(form.barcode) ?? undefined,
    description: normalizeOptionalText(form.description) ?? undefined,
    imageUrl: normalizeImageUrl(form.imageUrl),
    status: form.status,
    stock: Number(form.stock || 0),
    minStock: Number(form.minStock || DEFAULT_MIN_STOCK),
    unitType: form.unitType,
    warehouseLocation: normalizeOptionalText(form.warehouseLocation) ?? undefined,
    buyPrice: Number(form.buyPrice || 0),
    sellPrice: Number(form.sellPrice || 0),
    vatRate: Number(form.vatRate || 20),
  };
}

export function mapProductFieldErrors(
  errors?: Record<string, string[] | undefined>
) {
  if (!errors) return {};

  return Object.fromEntries(
    Object.entries(errors)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
      .map(([key, value]) => [key, value[0] ?? ""])
  );
}

export function getFirstProductErrorMessage(
  message?: string,
  errors?: Record<string, string[] | undefined>
) {
  if (message && message !== "Bilgileri kontrol edin.") {
    return message;
  }

  const fieldErrors = mapProductFieldErrors(errors);
  return Object.values(fieldErrors)[0] ?? message;
}

export function calculateProductProfit(buyPrice: number, sellPrice: number) {
  const profit = sellPrice - buyPrice;
  const margin =
    buyPrice > 0 ? (profit / buyPrice) * 100 : sellPrice > 0 ? 100 : 0;

  return {
    profit,
    margin,
  };
}

export function formatProfitMargin(margin: number) {
  return `%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
  }).format(margin)}`;
}

export function getStockStatusLabel(stock: number, minStock: number) {
  if (stock <= 0) {
    return {
      label: "Stok yok",
      className: "bg-rose-50 text-rose-700",
    };
  }

  if (stock <= minStock) {
    return {
      label: "Kritik seviye",
      className: "bg-orange-50 text-orange-700",
    };
  }

  return {
    label: "Yeterli stok",
    className: "bg-emerald-50 text-emerald-700",
  };
}

export function productToFormValues(product: {
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  imageUrl?: string | null;
  status: string;
  stock: number;
  minStock: number;
  unitType: ProductUnitType;
  warehouseLocation: string | null;
  buyPrice: unknown;
  sellPrice: unknown;
  vatRate: number;
  category?: { name: string } | null;
}): ProductFormValues {
  return {
    name: product.name,
    categoryName: product.category?.name ?? DEFAULT_CATEGORY_NAME,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    status: product.status === "PASSIVE" ? "PASSIVE" : "ACTIVE",
    stock: String(product.stock),
    minStock: String(product.minStock),
    unitType: product.unitType,
    warehouseLocation: product.warehouseLocation ?? "",
    buyPrice: String(Number(product.buyPrice)),
    sellPrice: String(Number(product.sellPrice)),
    vatRate: String(product.vatRate),
  };
}
