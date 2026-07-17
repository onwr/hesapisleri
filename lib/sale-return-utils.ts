import { roundMoney } from "@/lib/sale-payment-utils";
import { isServiceProductType } from "@/lib/product-type-utils";

export type SaleReturnRefundMethod = "CASH" | "CARD" | "CREDIT";

export type SaleReturnLineInput = {
  saleItemId: string;
  quantity: number;
  restock?: boolean;
  note?: string | null;
};

export type SaleReturnItemLike = {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  name: string;
  productId: string | null;
  warehouseId?: string | null;
  productType?: string | null;
};

export function getSaleReturnRefundMethodLabel(method: SaleReturnRefundMethod) {
  if (method === "CASH") return "Nakit iade";
  if (method === "CARD") return "Kart iade";
  return "Cari düzeltme";
}

export function computeSaleReturnLineAmount(input: {
  quantity: number;
  soldQuantity: number;
  lineTotal: number;
  unitPrice: number;
}) {
  const qty = Math.floor(input.quantity);
  if (qty <= 0) return 0;
  if (input.soldQuantity <= 0) return 0;

  if (qty === input.soldQuantity) {
    return roundMoney(input.lineTotal);
  }

  return roundMoney((input.lineTotal / input.soldQuantity) * qty);
}

export function buildReturnedQuantityMap(
  returnItems: Array<{ saleItemId: string; quantity: number }>
) {
  const map = new Map<string, number>();
  for (const item of returnItems) {
    map.set(item.saleItemId, (map.get(item.saleItemId) ?? 0) + item.quantity);
  }
  return map;
}

export function getReturnableQuantity(
  soldQuantity: number,
  alreadyReturnedQuantity: number
) {
  return Math.max(0, soldQuantity - Math.max(0, alreadyReturnedQuantity));
}

export function resolveSaleReturnStatus(input: {
  items: Array<{ quantity: number; alreadyReturned: number; returning: number }>;
}): "REFUNDED" | "PARTIALLY_REFUNDED" {
  const fullyReturned = input.items.every(
    (item) => item.alreadyReturned + item.returning >= item.quantity
  );
  return fullyReturned ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

export function shouldRestockReturnItem(input: {
  restock?: boolean;
  productType?: string | null;
  productId?: string | null;
}) {
  if (!input.productId) return false;
  if (isServiceProductType(input.productType)) return false;
  return input.restock !== false;
}

export function allocateSaleReturnRefundAmounts(input: {
  refundMethod: SaleReturnRefundMethod;
  totalReturnAmount: number;
}) {
  const total = roundMoney(input.totalReturnAmount);
  if (input.refundMethod === "CASH") {
    return {
      totalCashRefund: total,
      totalCardRefund: 0,
      totalCreditAdjustment: 0,
    };
  }
  if (input.refundMethod === "CARD") {
    return {
      totalCashRefund: 0,
      totalCardRefund: total,
      totalCreditAdjustment: 0,
    };
  }
  return {
    totalCashRefund: 0,
    totalCardRefund: 0,
    totalCreditAdjustment: total,
  };
}

export function validateSaleReturnLines(input: {
  saleStatus: string;
  items: SaleReturnItemLike[];
  alreadyReturnedByItemId: Map<string, number>;
  lines: SaleReturnLineInput[];
}) {
  if (
    input.saleStatus === "CANCELLED" ||
    input.saleStatus === "REFUNDED" ||
    input.saleStatus === "DRAFT"
  ) {
    return {
      ok: false as const,
      message:
        input.saleStatus === "CANCELLED"
          ? "İptal edilmiş satışa iade yapılamaz."
          : input.saleStatus === "REFUNDED"
            ? "Bu satış zaten tamamen iade edilmiş."
            : "Teklif/satış taslağına iade yapılamaz.",
    };
  }

  if (!input.lines.length) {
    return { ok: false as const, message: "En az bir ürün iade edilmelidir." };
  }

  const saleItemById = new Map(input.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let totalReturnAmount = 0;
  const normalized: Array<{
    saleItem: SaleReturnItemLike;
    quantity: number;
    totalAmount: number;
    restock: boolean;
    note: string | null;
  }> = [];

  for (const line of input.lines) {
    if (seen.has(line.saleItemId)) {
      return {
        ok: false as const,
        message: "Aynı ürün satırı birden fazla kez seçilemez.",
      };
    }
    seen.add(line.saleItemId);

    const saleItem = saleItemById.get(line.saleItemId);
    if (!saleItem) {
      return {
        ok: false as const,
        message: "İade satırı satışta bulunamadı.",
      };
    }

    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        ok: false as const,
        message: "İade adedi 0’dan büyük olmalıdır.",
      };
    }

    const already = input.alreadyReturnedByItemId.get(saleItem.id) ?? 0;
    const returnable = getReturnableQuantity(saleItem.quantity, already);
    if (qty > returnable) {
      return {
        ok: false as const,
        message: `${saleItem.name} için iade edilebilir adet: ${returnable}.`,
      };
    }

    const totalAmount = computeSaleReturnLineAmount({
      quantity: qty,
      soldQuantity: saleItem.quantity,
      lineTotal: saleItem.total,
      unitPrice: saleItem.unitPrice,
    });

    totalReturnAmount = roundMoney(totalReturnAmount + totalAmount);
    normalized.push({
      saleItem,
      quantity: qty,
      totalAmount,
      restock: shouldRestockReturnItem({
        restock: line.restock,
        productType: saleItem.productType,
        productId: saleItem.productId,
      }),
      note: line.note?.trim() || null,
    });
  }

  if (totalReturnAmount <= 0) {
    return {
      ok: false as const,
      message: "İade tutarı sıfırdan büyük olmalıdır.",
    };
  }

  return {
    ok: true as const,
    totalReturnAmount,
    lines: normalized,
  };
}

export function generateSaleReturnNo(now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `RET-${stamp}-${suffix}`;
}
