/** Provider yanıtından hassas alanları çıkarır — DB ve API response için. */
export function redactProviderRefundResponse(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  const allow = new Set(["status", "err_no", "err_msg", "return_msg", "reference_no"]);
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (
      allow.has(lower) ||
      lower.endsWith("_status") ||
      lower === "merchant_oid"
    ) {
      if (typeof value === "string" && value.length > 120) {
        safe[key] = `${value.slice(0, 8)}…`;
      } else {
        safe[key] = value;
      }
    }
  }
  return Object.keys(safe).length ? safe : { redacted: true };
}
