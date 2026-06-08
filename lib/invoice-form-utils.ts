export type InvoiceLineItem = {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  stock: number;
  sellPrice: string | number;
  vatRate: number;
  category?: {
    name: string;
  } | null;
};

export { formatMoney } from "@/lib/format-utils";

export function createEmptyItem(): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 20,
  };
}

export function getStockClass(stock: number) {
  if (stock <= 0) return "bg-rose-50 text-rose-500";
  if (stock <= 10) return "bg-orange-50 text-orange-500";
  return "bg-emerald-50 text-emerald-600";
}

export function getUsedProductQuantity(
  items: InvoiceLineItem[],
  productId: string
) {
  return items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function getMaxQuantityForItem(
  products: CatalogProduct[],
  items: InvoiceLineItem[],
  item: InvoiceLineItem
) {
  if (!item.productId) return null;

  const product = products.find((entry) => entry.id === item.productId);
  if (!product) return null;

  const usedElsewhere = items
    .filter(
      (entry) => entry.productId === item.productId && entry.id !== item.id
    )
    .reduce((sum, entry) => sum + entry.quantity, 0);

  return Math.max(0, product.stock - usedElsewhere);
}

export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  discountAmount: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const discount = Math.min(Math.max(0, discountAmount), subtotal);
  const netSubtotal = subtotal - discount;

  let vatTotal = 0;

  if (subtotal > 0) {
    for (const item of items) {
      const lineBase = item.quantity * item.unitPrice;
      const lineShare = lineBase / subtotal;
      const discountedLineBase = lineBase - discount * lineShare;
      vatTotal += (discountedLineBase * item.vatRate) / 100;
    }
  }

  return {
    subtotal,
    discount,
    vatTotal,
    total: netSubtotal + vatTotal,
  };
}

export function previewInvoiceNo() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `FTR-${year}-${random}`;
}
