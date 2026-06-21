import "server-only";

/** Proration kapalıyken IMMEDIATE plan/dönem değişimi engellenir. */
export function isBillingProrationEnabled() {
  return process.env.BILLING_PRORATION_ENABLED === "true";
}
