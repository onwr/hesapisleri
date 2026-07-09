/**
 * Sipay HTTP debug — secret/token/hash loglamaz.
 * Varsayılan: development'ta açık; production'da SIPAY_HTTP_DEBUG=true gerekir.
 */

export function isSipayHttpDebugEnabled(): boolean {
  const flag = process.env.SIPAY_HTTP_DEBUG?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return process.env.NODE_ENV !== "production";
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function safeSipayRequestContext(body: Record<string, unknown>) {
  return {
    invoiceId: pickString(body.invoice_id) ?? pickString(body.invoiceId),
    amount: body.amount ?? body.total ?? body.product_price,
    currency: body.currency_code ?? body.currency,
    referenceNo: pickString(body.reference_no),
  };
}

export function safeSipayResponseSummary(data: unknown) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const root = data as Record<string, unknown>;
  const inner =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : {};

  return {
    statusCode: root.status_code,
    statusDescription:
      root.status_description ??
      root.success_message ??
      root.error_message,
    paymentStatus: inner.payment_status,
    transactionStatus: inner.transaction_status,
    errorCode: inner.error_code,
    errorDescription: inner.error_description,
    invoiceId: pickString(inner.invoice_id) ?? pickString(root.invoice_id),
    orderId: pickString(inner.order_id) ?? pickString(inner.order_no),
    transactionId: pickString(inner.transaction_id),
  };
}

export function logSipayHttpRequest(
  path: string,
  body?: Record<string, unknown>
) {
  if (!isSipayHttpDebugEnabled()) return;

  const context =
    body && path.includes("token")
      ? { tokenRequest: true }
      : body
        ? safeSipayRequestContext(body)
        : {};

  console.info("[sipay-http] request", { path, ...context });
}

export function logSipayHttpResponse(
  path: string,
  data: unknown,
  httpStatus = 200
) {
  if (!isSipayHttpDebugEnabled()) return;

  console.info("[sipay-http] response", {
    path,
    httpStatus,
    ...safeSipayResponseSummary(data),
  });
}

export function logSipayHttpFailure(
  path: string,
  input: {
    httpStatus?: number;
    message: string;
    requestContext?: Record<string, unknown>;
  }
) {
  if (!isSipayHttpDebugEnabled()) return;

  const request =
    input.requestContext && !path.includes("token")
      ? safeSipayRequestContext(input.requestContext)
      : path.includes("token")
        ? { tokenRequest: true }
        : undefined;

  console.error("[sipay-http] error", {
    path,
    httpStatus: input.httpStatus,
    message: input.message,
    request,
  });
}
