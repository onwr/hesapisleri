export class MobileFinanceError extends Error {
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
    this.name = "MobileFinanceError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function mapFinanceServiceError(
  error: unknown,
  fallbackCode = "SERVER_ERROR"
): MobileFinanceError | null {
  if (error instanceof MobileFinanceError) return error;

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Fatura bulunamadı")) {
      return new MobileFinanceError("INVOICE_NOT_FOUND", msg, 404);
    }
    if (msg.includes("Gider bulunamadı")) {
      return new MobileFinanceError("EXPENSE_NOT_FOUND", msg, 404);
    }
    if (msg.includes("Müşteri bulunamadı")) {
      return new MobileFinanceError("CUSTOMER_NOT_FOUND", msg, 404);
    }
    if (msg.includes("Hesap bulunamadı")) {
      return new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", msg, 404);
    }
    if (msg.includes("Tedarikçi")) {
      return new MobileFinanceError("SUPPLIER_NOT_FOUND", msg, 404);
    }
    if (msg.includes("tahsilatı tamamlanmış") || msg.includes("zaten iptal")) {
      return new MobileFinanceError("INVOICE_ALREADY_PAID", msg, 400);
    }
    if (msg.includes("En fazla")) {
      return new MobileFinanceError("COLLECTION_AMOUNT_EXCEEDS_REMAINING", msg, 400);
    }
    if (msg.includes("Kaynak ve hedef")) {
      return new MobileFinanceError("TRANSFER_SAME_ACCOUNT", msg, 400);
    }
    if (msg.includes("yetersiz") || msg.includes("Yetersiz")) {
      return new MobileFinanceError("INSUFFICIENT_BALANCE", msg, 400);
    }
  }

  if (typeof error === "object" && error && "message" in error) {
    const msg = String((error as { message: string }).message);
    return new MobileFinanceError(fallbackCode, msg, 400);
  }

  return null;
}
