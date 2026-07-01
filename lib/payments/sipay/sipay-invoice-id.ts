import crypto from "node:crypto";

// invoice_id: globally unique, non-guessable, stable per PaymentAttempt
// Format: SI-<timestamp_hex>-<8 random hex bytes>
export function generateSipayInvoiceId(): string {
  const ts = Date.now().toString(16).toUpperCase();
  const rand = crypto.randomBytes(8).toString("hex").toUpperCase();
  return `SI-${ts}-${rand}`;
}

export function generatePayloadHash(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
