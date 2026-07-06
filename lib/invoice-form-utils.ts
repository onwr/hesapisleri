import { allowsNegativeStock } from "@/lib/stock-policy";
import {
  calculateInvoiceTotals as calculateInvoiceTotalsCore,
  type InvoiceLineInput,
} from "@/lib/invoice-tax-calculation-utils";
import {
  isServiceProductType,
  getProductStockDisplayLabel,
} from "@/lib/product-type-utils";

export type InvoiceLineItem = InvoiceLineInput & {
  id: string;
  productId?: string;
  name: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  stock: number;
  sellPrice: string | number;
  vatRate: number;
  productType?: string | null;
  category?: {
    name: string;
  } | null;
};

/** Hizmet ürünü stoksuzdur — stok kısıtları/uyarıları hiçbir zaman uygulanmaz. */
export function isServiceCatalogProduct(product: { productType?: string | null }) {
  return isServiceProductType(product.productType);
}

/** Ürün faturaya eklenebilir mi? Hizmet ürünleri stok=0 olsa bile her zaman eklenebilir. */
export function canAddProductToInvoice(
  product: CatalogProduct,
  usedQty: number
) {
  if (isServiceCatalogProduct(product)) return true;
  if (allowsNegativeStock()) return true;
  return product.stock - usedQty > 0;
}

/** Katalog kartında gösterilecek stok etiketi — hizmet ürünü için "Stoksuz". */
export function getCatalogStockLabel(product: CatalogProduct) {
  return getProductStockDisplayLabel(product);
}

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
  if (stock < 0) return "bg-rose-100 text-rose-700";
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
  if (allowsNegativeStock()) {
    return null;
  }

  if (!item.productId) return null;

  const product = products.find((entry) => entry.id === item.productId);
  if (!product) return null;

  // Hizmet ürünleri stok takibi yapmaz — miktar sınırı uygulanmaz.
  if (isServiceCatalogProduct(product)) return null;

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
  return calculateInvoiceTotalsCore(items, discountAmount);
}

export function previewInvoiceNo() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `FTR-${year}-${random}`;
}

export function formatInvoiceNumber(value: string) {
  return value.trim().toUpperCase();
}
