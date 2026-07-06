import { isServiceProductType } from "@/lib/product-type-utils";
import { allowsNegativeStock } from "@/lib/stock-policy";

export const MAX_SALE_CART_QUANTITY = 999_999;

export type SaleCartQuantityItem = {
  productId: string;
  quantity: number;
  stock: number;
  productType?: "STOCK" | "SERVICE" | string | null;
  name?: string;
};

export type ParsedSaleCartQuantityInput =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "valid"; value: number };

export function parseSaleCartQuantityInput(
  raw: string
): ParsedSaleCartQuantityInput {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { kind: "empty" };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { kind: "invalid" };
  }

  const value = Number(trimmed);

  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_SALE_CART_QUANTITY
  ) {
    return { kind: "invalid" };
  }

  return { kind: "valid", value };
}

export function normalizeCommittedSaleCartQuantity(
  value: number
): number | null {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_SALE_CART_QUANTITY
  ) {
    return null;
  }

  return value;
}

export function formatSaleCartQuantityInput(value: number) {
  return String(value);
}

export function buildSaleCartStockLimitMessage(
  productName: string,
  maxQuantity: number
) {
  return `Bu ürün için en fazla ${maxQuantity} adet satış yapabilirsiniz.`;
}

export function validateSaleCartQuantityAgainstStock(
  item: SaleCartQuantityItem,
  requestedQty: number,
  options?: {
    allowNegativeStock?: boolean;
    cartItems?: SaleCartQuantityItem[];
  }
): string | null {
  if (isServiceProductType(item.productType)) {
    return null;
  }

  const allowNegativeStock = allowsNegativeStock(
    options?.allowNegativeStock ?? false
  );

  if (allowNegativeStock) {
    return null;
  }

  const availableStock = Math.max(0, Math.floor(item.stock));

  if (requestedQty <= availableStock) {
    return null;
  }

  const label = item.name?.trim() || "Ürün";
  return buildSaleCartStockLimitMessage(label, availableStock);
}

export function resolveSaleCartQuantityCommit(input: {
  raw: string;
  currentQuantity: number;
  item: SaleCartQuantityItem;
  allowNegativeStock?: boolean;
}): {
  quantity: number | null;
  remove: boolean;
  error: string | null;
} {
  const parsed = parseSaleCartQuantityInput(input.raw);

  if (parsed.kind === "empty") {
    return {
      quantity: input.currentQuantity,
      remove: false,
      error: null,
    };
  }

  if (parsed.kind === "invalid") {
    return {
      quantity: input.currentQuantity,
      remove: false,
      error: "Geçerli bir adet girin.",
    };
  }

  if (parsed.value === 0) {
    return {
      quantity: null,
      remove: true,
      error: null,
    };
  }

  const normalized = normalizeCommittedSaleCartQuantity(parsed.value);

  if (normalized === null) {
    return {
      quantity: input.currentQuantity,
      remove: false,
      error: "Geçerli bir adet girin.",
    };
  }

  const stockError = validateSaleCartQuantityAgainstStock(input.item, normalized, {
    allowNegativeStock: input.allowNegativeStock,
  });

  if (stockError) {
    return {
      quantity: input.currentQuantity,
      remove: false,
      error: stockError,
    };
  }

  return {
    quantity: normalized,
    remove: false,
    error: null,
  };
}
