// Resmî Sipay API endpoint sabitleri (base URL + bu path = tam URL)
// Base URL: https://provisioning.sipay.com.tr (test) | https://app.sipay.com.tr (live)
export const SIPAY_ENDPOINTS = {
  TOKEN: "/ccpayment/api/token",
  PURCHASE_LINK: "/ccpayment/purchase/link",
  CHECKSTATUS: "/ccpayment/api/checkstatus",
  REFUND: "/ccpayment/api/refund",
} as const;

// Bu fazda kullanılmıyor — referans için saklandı
export const SIPAY_ENDPOINTS_BACKLOG = {
  PAY_SMART_2D: "/ccpayment/api/paySmart2D",       // Non-Secure 2D — bu fazda disabled
  PAY_SMART_3D: "/ccpayment/api/paySmart3D",       // 3D secure form submit — hosted link tercih edildi
  PAYMENT_COMPLETE: "/ccpayment/payment/complete",  // Hosted form tamamlama
  CONFIRM_PAYMENT: "/ccpayment/api/confirmPayment", // 2-step confirm
  RECURRING_ORDER: "/ccpayment/api/recurringOrder", // Otomatik kart çekimi — bu fazda disabled
  SAVE_CARD: "/ccpayment/api/saveCreditCard",       // Kart saklama — bu fazda disabled
  LIST_CARDS: "/ccpayment/api/getUserSavedCards",   // Kayıtlı kartlar
  DELETE_CARD: "/ccpayment/api/deleteSavedCards",   // Kayıtlı kart silme
} as const;

// URL birleşimi doğrulama — çift /ccpayment/ccpayment veya eksik path oluşmamalı
export function buildSipayUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${normalizedBase}${normalizedPath}`;
  // Guard: çift segment olmamalı
  if (url.includes("//ccpayment") || url.includes("ccpayment/ccpayment")) {
    throw new Error(`Sipay URL path duplication detected: ${url}`);
  }
  return url;
}
