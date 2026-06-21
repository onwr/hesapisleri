import "server-only";

import { setTimeout as sleep } from "node:timers/promises";
import { PAYTR_API_BASE_URL } from "./paytr-config";
import type { PaytrApiResponse } from "./paytr-types";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_CHARS = 64_000;

function assertAllowedUrl(url: URL) {
  const allowed = new URL(PAYTR_API_BASE_URL);
  if (url.protocol !== "https:" || url.hostname !== allowed.hostname) {
    throw new Error("PayTR endpoint allowlist dışında.");
  }
}

export async function postPaytrForm(
  path: string,
  fields: Record<string, string>,
  options: { retrySafe?: boolean } = {}
): Promise<PaytrApiResponse> {
  const url = new URL(path, PAYTR_API_BASE_URL);
  assertAllowedUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (text.length > MAX_RESPONSE_CHARS) {
      throw new Error("PayTR response limiti aşıldı.");
    }

    try {
      return JSON.parse(text) as PaytrApiResponse;
    } catch {
      return Object.fromEntries(new URLSearchParams(text)) as PaytrApiResponse;
    }
  } catch (error) {
    if (options.retrySafe) {
      await sleep(250);
      return postPaytrForm(path, fields, { retrySafe: false });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
