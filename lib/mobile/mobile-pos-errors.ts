import { PosCheckoutIdempotencyError } from "@/lib/pos-checkout-idempotency";
import { SaleStockValidationError } from "@/lib/pos-checkout-service";

export class MobilePosError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "MobilePosError";
    this.code = code;
    this.status = status;
  }
}

export function mapPosCheckoutError(error: unknown): MobilePosError | null {
  if (error instanceof MobilePosError) return error;

  if (error instanceof PosCheckoutIdempotencyError) {
    return new MobilePosError("IDEMPOTENCY_CONFLICT", error.message, 409);
  }

  if (error instanceof SaleStockValidationError) {
    const message = error.message.toLowerCase();
    if (message.includes("yetersiz") || message.includes("stok")) {
      return new MobilePosError("INSUFFICIENT_STOCK", error.message, 400);
    }
    return new MobilePosError("OUT_OF_STOCK", error.message, 400);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("bulunamadı") && msg.includes("ürün")) {
      return new MobilePosError("PRODUCT_NOT_FOUND", error.message, 404);
    }
    if (msg.includes("müşteri")) {
      return new MobilePosError("FORBIDDEN", error.message, 403);
    }
    if (msg.includes("ödeme") || msg.includes("tahsilat")) {
      return new MobilePosError("INVALID_PAYMENT", error.message, 400);
    }
    if (msg.includes("indirim")) {
      return new MobilePosError("INVALID_DISCOUNT", error.message, 400);
    }
  }

  return null;
}
