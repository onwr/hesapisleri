import { getStockMovementWarning } from "@/lib/stock-policy";
import { z } from "zod";

export const STOCK_MOVEMENT_REQUEST_TYPES = [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "COUNT",
] as const;

export type StockMovementRequestType =
  (typeof STOCK_MOVEMENT_REQUEST_TYPES)[number];

export const STOCK_MOVEMENT_TYPE_LABELS: Record<
  StockMovementRequestType,
  string
> = {
  IN: "Stok Girişi",
  OUT: "Stok Çıkışı",
  ADJUSTMENT: "Düzeltme",
  COUNT: "Sayım",
};

export const stockMovementRequestSchema = z.object({
  type: z.enum(STOCK_MOVEMENT_REQUEST_TYPES),
  quantity: z.number(),
  warehouseId: z.string().optional(),
  note: z.string().optional(),
  warehouseLocation: z.string().optional(),
  movementDate: z.string().optional(),
  supplierId: z.string().optional(),
});

export type StockMovementRequestInput = z.infer<
  typeof stockMovementRequestSchema
>;

export type StockMovementCalculation = {
  newStock: number;
  movementQuantity: number;
  dbType: StockMovementRequestType;
  warning?: string;
};

export function normalizeMovementNote(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseMovementDate(value?: string | null) {
  if (!value?.trim()) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function calculateStockMovement(
  type: StockMovementRequestType,
  currentStock: number,
  quantity: number
): StockMovementCalculation | { error: string } {
  if (type === "IN") {
    if (quantity <= 0) {
      return { error: "Stok girişi miktarı 0'dan büyük olmalıdır." };
    }

    return {
      newStock: currentStock + quantity,
      movementQuantity: quantity,
      dbType: "IN",
    };
  }

  if (type === "OUT") {
    if (quantity <= 0) {
      return { error: "Stok çıkışı miktarı 0'dan büyük olmalıdır." };
    }

    const newStock = currentStock - quantity;
    const warning = getStockMovementWarning(currentStock, newStock);

    return {
      newStock,
      movementQuantity: quantity,
      dbType: "OUT",
      ...(warning ? { warning } : {}),
    };
  }

  if (type === "ADJUSTMENT") {
    if (quantity === 0) {
      return { error: "Düzeltme miktarı 0 olamaz." };
    }

    const newStock = currentStock + quantity;
    const warning = getStockMovementWarning(currentStock, newStock);

    return {
      newStock,
      movementQuantity: quantity,
      dbType: "ADJUSTMENT",
      ...(warning ? { warning } : {}),
    };
  }

  if (quantity < 0) {
    return { error: "Sayım sonucu 0'dan küçük olamaz." };
  }

  const delta = quantity - currentStock;

  return {
    newStock: quantity,
    movementQuantity: delta,
    dbType: "COUNT",
  };
}

export function formatMovementQuantityDisplay(
  type: string,
  quantity: number
) {
  if (type === "IN" || type === "RETURN" || type === "TRANSFER_IN") {
    return quantity >= 0 ? `+${Math.abs(quantity)}` : `${quantity}`;
  }

  if (type === "OUT" || type === "SALE" || type === "TRANSFER_OUT") {
    return quantity >= 0 ? `-${Math.abs(quantity)}` : `${quantity}`;
  }

  if (type === "ADJUSTMENT" || type === "COUNT") {
    return quantity >= 0 ? `+${quantity}` : `${quantity}`;
  }

  return String(quantity);
}

export function isMovementIncoming(type: string, quantity: number) {
  if (type === "IN" || type === "RETURN") {
    return true;
  }

  if (type === "OUT" || type === "SALE") {
    return false;
  }

  if (type === "ADJUSTMENT" || type === "COUNT") {
    return quantity >= 0;
  }

  return quantity >= 0;
}

export function getQuantityFieldLabel(type: StockMovementRequestType) {
  return type === "COUNT" ? "Yeni gerçek stok" : "Miktar";
}

export function getQuantityFieldHint(type: StockMovementRequestType) {
  switch (type) {
    case "IN":
      return "Stoğa eklenecek miktarı girin.";
    case "OUT":
      return "Stoktan düşülecek miktarı girin.";
    case "ADJUSTMENT":
      return "Pozitif veya negatif değer girebilirsiniz.";
    case "COUNT":
      return "Depodaki gerçek stok miktarını girin; fark otomatik hesaplanır.";
  }
}

export function toDateTimeLocalValue(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function mapStockMovementFieldErrors(
  errors?: Record<string, string[] | undefined>
) {
  if (!errors) return {};

  return Object.fromEntries(
    Object.entries(errors)
      .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
      .map(([key, value]) => [key, value[0] ?? ""])
  );
}

export function getFirstStockMovementErrorMessage(
  message?: string,
  errors?: Record<string, string[] | undefined>
) {
  if (message && message !== "Bilgileri kontrol edin.") {
    return message;
  }

  const fieldErrors = mapStockMovementFieldErrors(errors);
  return Object.values(fieldErrors)[0] ?? message;
}

export function buildStockMovementActivityMessage(
  productName: string,
  type: StockMovementRequestType,
  movementQuantity: number,
  newStock: number
) {
  const label = STOCK_MOVEMENT_TYPE_LABELS[type];
  const quantityText = formatMovementQuantityDisplay(type, movementQuantity);

  return `${productName} için ${label} yapıldı (${quantityText}). Yeni stok: ${newStock}.`;
}
