import { MobileAuthError } from "./mobile-auth-guards";
import { PosCheckoutIdempotencyError } from "@/lib/pos-checkout-idempotency";
import { SaleStockValidationError } from "@/lib/pos-checkout-service";
import { EntitlementError } from "@/lib/billing/entitlements/entitlement-errors";

export class MobileCatalogError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "MobileCatalogError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function mapCatalogError(error: unknown): MobileCatalogError | null {
  if (error instanceof MobileCatalogError) return error;

  if (error instanceof MobileAuthError) {
    return new MobileCatalogError(error.code, error.message, error.status);
  }

  if (error instanceof EntitlementError) {
    return new MobileCatalogError("FORBIDDEN", error.message, error.status);
  }

  if (error instanceof SaleStockValidationError) {
    const msg = error.message ?? "Yetersiz stok.";
    if (msg.toLowerCase().includes("negatif")) {
      return new MobileCatalogError("NEGATIVE_STOCK_NOT_ALLOWED", msg, 400);
    }
    return new MobileCatalogError("INSUFFICIENT_STOCK", msg, 400);
  }

  if (error instanceof PosCheckoutIdempotencyError) {
    return new MobileCatalogError("IDEMPOTENCY_CONFLICT", error.message, 409);
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Kaynak ve hedef depo aynı")) {
      return new MobileCatalogError("TRANSFER_SAME_WAREHOUSE", msg, 400);
    }
    if (msg.includes("stok takibi")) {
      return new MobileCatalogError("STOCK_TRACKING_DISABLED", msg, 400);
    }
  }

  return null;
}
