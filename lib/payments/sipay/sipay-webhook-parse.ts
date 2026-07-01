import { SIPAY_WEBHOOK_MAX_BODY_BYTES } from "./sipay-webhook-handler";

const ALLOWED_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];

function toStringRecord(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)]),
  );
}

export async function parseSipayWebhookPayload(request: Request): Promise<Record<string, string>> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  }

  const body = await request.text();
  if (body.length > SIPAY_WEBHOOK_MAX_BODY_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  if (ct.includes("application/json")) {
    return toStringRecord(JSON.parse(body) as Record<string, unknown>);
  }

  if (ct.includes("application/x-www-form-urlencoded") || !ct) {
    return Object.fromEntries(new URLSearchParams(body).entries());
  }

  if (!ALLOWED_CONTENT_TYPES.some((allowed) => ct.includes(allowed))) {
    throw new Error("UNSUPPORTED_MEDIA_TYPE");
  }

  return Object.fromEntries(new URLSearchParams(body).entries());
}
