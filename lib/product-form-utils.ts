import { z } from "zod";
import {
  formatMoneyInput,
  parseProductMoneyInput,
} from "@/lib/money-input-utils";
import {
  normalizeServiceProductFields,
  parseProductType,
  type ProductTypeKey,
} from "@/lib/product-type-utils";

export const PRODUCT_UNIT_TYPES = [
  "PIECE",
  "KG",
  "METER",
  "LITER",
  "PACK",
  "HOUR",
  "DAY",
  "JOB",
] as const;

export const STOCK_PRODUCT_UNIT_TYPES = [
  "PIECE",
  "KG",
  "METER",
  "LITER",
  "PACK",
] as const;

export const SERVICE_PRODUCT_UNIT_TYPES = [
  "PIECE",
  "HOUR",
  "DAY",
  "JOB",
  "PACK",
] as const;

export type ProductUnitType = (typeof PRODUCT_UNIT_TYPES)[number];

export const PRODUCT_UNIT_LABELS: Record<ProductUnitType, string> = {
  PIECE: "Adet",
  KG: "Kg",
  METER: "Metre",
  LITER: "Litre",
  PACK: "Paket",
  HOUR: "Saat",
  DAY: "Gün",
  JOB: "İşlem",
};

export const DEFAULT_CATEGORY_NAME = "Genel";
export const DEFAULT_MIN_STOCK = 10;

const optionalTextField = z.string().nullish();

export const PRODUCT_FIELD_LABELS: Record<string, string> = {
  productType: "Ürün tipi",
  name: "Ürün adı",
  categoryName: "Kategori",
  sku: "Stok kodu",
  barcode: "Barkod",
  description: "Açıklama",
  imageUrl: "Görsel",
  status: "Durum",
  stock: "Stok",
  minStock: "Minimum stok",
  unitType: "Birim",
  warehouseLocation: "Depo konumu",
  buyPrice: "Alış fiyatı",
  sellPrice: "Satış fiyatı",
  vatRate: "KDV oranı",
};

function humanizeProductFieldError(field: string, message: string) {
  const label = PRODUCT_FIELD_LABELS[field] ?? field;

  if (/[ğüşıöçĞÜŞİÖÇ]/.test(message)) {
    return message;
  }

  if (message.includes("expected string, received null")) {
    return `${label} alanı geçersiz.`;
  }
  if (message.includes("expected string, received number")) {
    return `${label} metin olmalıdır.`;
  }
  if (message.includes("expected number, received")) {
    return `${label} sayısal bir değer olmalıdır.`;
  }
  if (
    message.includes("Invalid enum value") ||
    message.includes("Invalid option")
  ) {
    return `${label} için geçersiz seçim.`;
  }
  if (message.includes("Too small") || message.includes("too small")) {
    return `${label} çok kısa.`;
  }
  if (message.includes("Too big") || message.includes("too big")) {
    return `${label} çok uzun.`;
  }
  if (message.startsWith("Invalid input")) {
    return `${label} alanı geçersiz.`;
  }

  return message;
}

export function formatProductValidationErrors(
  fieldErrors: Record<string, string[] | undefined>
) {
  const formatted: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages?.length) continue;
    formatted[field] = messages.map((message) =>
      humanizeProductFieldError(field, message)
    );
  }

  return formatted;
}

export const productFormSchema = z.object({
  productType: z.enum(["STOCK", "SERVICE"]).default("STOCK"),
  name: z.string().min(2, "Ürün adı en az 2 karakter olmalıdır."),
  categoryName: optionalTextField,
  sku: optionalTextField,
  barcode: z.string().nullable().optional(),
  description: optionalTextField,
  imageUrl: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).default("ACTIVE"),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(DEFAULT_MIN_STOCK),
  unitType: z.enum(PRODUCT_UNIT_TYPES).default("PIECE"),
  warehouseLocation: optionalTextField,
  buyPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  vatRate: z.number().min(0).default(20),
});

export const productUpdateSchema = productFormSchema.omit({ stock: true });

export type ProductFormInput = z.infer<typeof productFormSchema>;

export type ProductFormValues = {
  productType: ProductTypeKey;
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
  productType: "STOCK",
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

export type ProductBarcodePayloadMode = "omit" | "include" | "clear";

export type BuildProductPayloadOptions = {
  barcodeMode?: ProductBarcodePayloadMode;
};

export function resolveInitialBarcodePayloadMode(
  mode: "create" | "edit",
  barcode?: string | null
): ProductBarcodePayloadMode {
  if (mode === "create") {
    return "omit";
  }

  return normalizeOptionalText(barcode) ? "include" : "omit";
}

export function buildProductPayload(
  form: ProductFormValues,
  options?: BuildProductPayloadOptions
): ProductFormInput {
  const productType = parseProductType(form.productType);
  const payload: ProductFormInput = {
    productType,
    name: form.name.trim(),
    categoryName: normalizeCategoryName(form.categoryName),
    sku: normalizeOptionalText(form.sku) ?? undefined,
    description: normalizeOptionalText(form.description) ?? undefined,
    imageUrl: normalizeImageUrl(form.imageUrl),
    status: form.status,
    stock: Number(form.stock || 0),
    minStock: Number(form.minStock || DEFAULT_MIN_STOCK),
    unitType: form.unitType,
    warehouseLocation: normalizeOptionalText(form.warehouseLocation) ?? undefined,
    buyPrice: parseProductMoneyInput(form.buyPrice),
    sellPrice: parseProductMoneyInput(form.sellPrice),
    vatRate: Number(form.vatRate || 20),
  };

  const barcodeMode = options?.barcodeMode ?? "include";

  if (productType === "SERVICE") {
    return normalizeServiceProductFields({
      ...payload,
      barcode: null,
    });
  }

  if (barcodeMode === "clear") {
    payload.barcode = null;
  } else if (barcodeMode === "include") {
    payload.barcode = normalizeOptionalText(form.barcode) ?? null;
  }

  return payload;
}

export function shouldIncludeBarcodeInJsonPayload(
  barcodeMode: ProductBarcodePayloadMode
) {
  return barcodeMode === "include" || barcodeMode === "clear";
}

export function mapProductFieldErrors(
  errors?: Record<string, string[] | undefined>
) {
  if (!errors) return {};

  const formatted = formatProductValidationErrors(errors);

  return Object.fromEntries(
    Object.entries(formatted).map(([key, value]) => [key, value[0] ?? ""])
  );
}

export function getFirstProductErrorMessage(
  message?: string,
  errors?: Record<string, string[] | undefined>
) {
  const fieldErrors = mapProductFieldErrors(errors);
  const firstFieldError = Object.values(fieldErrors)[0];

  if (firstFieldError) {
    return firstFieldError;
  }

  if (message && message !== "Bilgileri kontrol edin.") {
    return message;
  }

  return message ?? "Bilgileri kontrol edin.";
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

export function getUnitTypesForProductType(productType: ProductTypeKey) {
  return productType === "SERVICE"
    ? SERVICE_PRODUCT_UNIT_TYPES
    : STOCK_PRODUCT_UNIT_TYPES;
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
  productType?: ProductTypeKey | string | null;
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
    productType: parseProductType(product.productType),
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
    buyPrice: formatMoneyInput(Number(product.buyPrice)),
    sellPrice: formatMoneyInput(Number(product.sellPrice)),
    vatRate: String(product.vatRate),
  };
}
