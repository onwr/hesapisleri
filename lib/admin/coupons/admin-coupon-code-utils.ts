export const RESERVED_COUPON_CODES = new Set([
  "ADMIN",
  "API",
  "NULL",
  "TEST",
  "TRIAL",
  "FREE",
  "DISCOUNT",
  "KUPON",
  "COUPON",
  "PROMO",
  "SYSTEM",
]);

export function assertCouponCodeAllowed(code: string) {
  if (RESERVED_COUPON_CODES.has(code)) {
    throw new Error(`"${code}" rezerve kupon kodudur.`);
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new Error("Kupon kodu yalnızca A-Z, 0-9, _ ve - içerebilir.");
  }
}
