import { SIPAY_ALLOWED_ORIGINS } from "./sipay-env";
import { buildSipayUrl } from "./sipay-endpoints";
import { SipayNetworkError } from "./sipay-errors";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

export type SipayPostOptions = {
  onUnauthorized?: () => Promise<string>;
};

function assertAllowedUrl(url: string): void {
  const allowed = SIPAY_ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
  if (!allowed) {
    throw new SipayNetworkError(`Sipay request blocked — URL not in allowlist: ${url}`);
  }
}

async function executePost<T>(
  url: string,
  path: string,
  init: RequestInit,
  options?: SipayPostOptions,
  retried = false,
): Promise<T> {
  assertAllowedUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SipayNetworkError(`Sipay request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`);
    }
    throw new SipayNetworkError(`Sipay request failed: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && options?.onUnauthorized && !retried) {
    const nextToken = await options.onUnauthorized();
    if (!nextToken) {
      throw new SipayNetworkError("Sipay unauthorized and token refresh stopped", 401);
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${nextToken}`);
    return executePost<T>(url, path, { ...init, headers }, options, true);
  }

  if (!response.ok) {
    throw new SipayNetworkError(`Sipay HTTP ${response.status} on ${path}`, response.status);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new SipayNetworkError(`Sipay response too large (${contentLength} bytes)`);
  }

  const text = await response.text();
  if (text.length === 0) {
    throw new SipayNetworkError(`Sipay empty response from ${path}`);
  }
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new SipayNetworkError("Sipay response body too large");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SipayNetworkError(`Sipay returned non-JSON response from ${path}`);
  }
}

export async function sipayPost<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  token: string,
  options?: SipayPostOptions,
): Promise<T> {
  const url = buildSipayUrl(baseUrl, path);
  return executePost<T>(
    url,
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    options,
  );
}

// Token endpoint uses form-encoded body (no auth token required)
export async function sipayPostToken<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = buildSipayUrl(baseUrl, path);
  assertAllowedUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SipayNetworkError(`Sipay token request timed out`);
    }
    throw new SipayNetworkError(`Sipay token request failed: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new SipayNetworkError(`Sipay token HTTP ${response.status}`, response.status);
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new SipayNetworkError(`Sipay token response body too large`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SipayNetworkError(`Sipay token returned non-JSON response`);
  }
}
