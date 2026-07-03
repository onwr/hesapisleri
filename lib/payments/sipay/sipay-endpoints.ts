import { normalizeSipayBaseUrl } from "./sipay-env";

// API path'leri base URL'nin (/ccpayment) altına eklenir.
// Tam URL örneği: https://app.sipay.com.tr/ccpayment/api/token
export const SIPAY_ENDPOINTS = {
  TOKEN: "/api/token",
  PURCHASE_LINK: "/purchase/link",
  CHECKSTATUS: "/api/checkstatus",
  REFUND: "/api/refund",
} as const;

// Bu fazda kullanılmıyor — referans için saklandı
export const SIPAY_ENDPOINTS_BACKLOG = {
  PAY_SMART_2D: "/api/paySmart2D",
  PAY_SMART_3D: "/api/paySmart3D",
  PAYMENT_COMPLETE: "/payment/complete",
  CONFIRM_PAYMENT: "/api/confirmPayment",
  RECURRING_ORDER: "/api/recurringOrder",
  SAVE_CARD: "/api/saveCreditCard",
  LIST_CARDS: "/api/getUserSavedCards",
  DELETE_CARD: "/api/deleteSavedCards",
} as const;

export function buildSipayUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeSipayBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath.startsWith("/ccpayment")) {
    throw new Error(
      `Sipay path must not include /ccpayment prefix when base URL already includes it: ${path}`,
    );
  }

  const url = `${normalizedBase}${normalizedPath}`;
  if (url.includes("ccpayment/ccpayment")) {
    throw new Error(`Sipay URL path duplication detected: ${url}`);
  }
  return url;
}
