export const STOCK_WARNING_INSUFFICIENT =
  "Bu ürünün mevcut stoğu yetersiz, işlem yine de yapılabilir.";

export const STOCK_WARNING_NEGATIVE_RESULT =
  "Bu işlem sonrası stok eksiye düşebilir.";

export const STOCK_WARNING_NEGATIVE_VALUE = "Stok eksi değerde.";

export function allowsNegativeStock() {
  return true;
}

export type StockWarningItem = {
  productId?: string;
  productName?: string;
  availableQty: number;
  requestedQty: number;
  message: string;
};

export function isNegativeStock(stock: number) {
  return stock < 0;
}

export function isZeroOrNegativeStock(stock: number) {
  return stock <= 0;
}

export function willStockGoNegative(availableQty: number, requestedQty: number) {
  return availableQty < requestedQty;
}

export function getStockWarning(
  availableQty: number,
  requestedQty: number,
  productName?: string
): string | null {
  if (!allowsNegativeStock()) {
    return null;
  }

  if (availableQty < 0) {
    return STOCK_WARNING_NEGATIVE_VALUE;
  }

  if (availableQty < requestedQty) {
    return productName
      ? `${productName}: ${STOCK_WARNING_INSUFFICIENT}`
      : STOCK_WARNING_INSUFFICIENT;
  }

  return null;
}

export function getStockMovementWarning(
  currentStock: number,
  newStock: number
): string | null {
  if (!allowsNegativeStock()) {
    return null;
  }

  if (newStock < 0) {
    return STOCK_WARNING_NEGATIVE_RESULT;
  }

  if (currentStock >= 0 && newStock < currentStock && newStock === 0) {
    return STOCK_WARNING_INSUFFICIENT;
  }

  return null;
}

export function buildInsufficientStockWarning(input: {
  productName: string;
  warehouseName: string;
  availableQty: number;
  requestedQty: number;
}): StockWarningItem {
  return {
    productName: input.productName,
    availableQty: input.availableQty,
    requestedQty: input.requestedQty,
    message: `${input.warehouseName} deposunda ${input.productName} için mevcut stok: ${input.availableQty}. ${STOCK_WARNING_INSUFFICIENT}`,
  };
}
