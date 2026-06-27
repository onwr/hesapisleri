import { createHash } from "node:crypto";
import type { PosCheckoutInput } from "@/lib/pos-checkout-utils";

export const POS_IDEMPOTENCY_KEY_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[a-zA-Z0-9_-]{16,128})$/i;

export const POS_IDEMPOTENCY_CONFLICT_CODE = "IDEMPOTENCY_KEY_CONFLICT";

export const POS_IDEMPOTENCY_CONFLICT_MESSAGE =
  "Bu işlem anahtarı farklı bir POS satışı için daha önce kullanılmış.";

export class PosCheckoutIdempotencyError extends Error {
  status = 409;
  code = POS_IDEMPOTENCY_CONFLICT_CODE;

  constructor(message = POS_IDEMPOTENCY_CONFLICT_MESSAGE) {
    super(message);
    this.name = "PosCheckoutIdempotencyError";
  }
}

export function validatePosIdempotencyKey(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return "İşlem anahtarı (idempotencyKey) zorunludur.";
  }
  if (trimmed.length > 128) {
    return "İşlem anahtarı en fazla 128 karakter olabilir.";
  }
  if (!POS_IDEMPOTENCY_KEY_PATTERN.test(trimmed)) {
    return "Geçersiz işlem anahtarı formatı.";
  }
  return null;
}

export function buildPosCheckoutPayloadHash(data: PosCheckoutInput) {
  const payload = {
    customerId: data.customerId?.trim() || null,
    warehouseId: data.warehouseId?.trim() || null,
    paymentStatus: data.paymentStatus,
    discount: data.discount,
    note: data.note?.trim() || null,
    items: [...data.items]
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    payments: [...data.payments]
      .map((payment) => ({
        accountId: payment.accountId,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
      }))
      .sort((a, b) =>
        `${a.accountId}:${a.paymentMethod}`.localeCompare(
          `${b.accountId}:${b.paymentMethod}`
        )
      ),
    collectedAmount:
      data.paymentStatus === "PARTIAL" ? (data.collectedAmount ?? 0) : null,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
