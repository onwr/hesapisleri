import { SIPAY_ALLOWED_ORIGINS } from "./sipay-env";
import { buildSipayUrl } from "./sipay-endpoints";
import { SipayNetworkError } from "./sipay-errors";
import {
  logSipayHttpFailure,
  logSipayHttpRequest,
  logSipayHttpResponse,
} from "./sipay-http-debug";

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
  options?: SipayPostOptions & { requestBody?: Record<string, unknown> },
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
      const message = `Sipay request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`;
      logSipayHttpFailure(path, {
        message,
        requestContext: options?.requestBody,
      });
      throw new SipayNetworkError(message);
    }
    const message = `Sipay request failed: ${String(err)}`;
    logSipayHttpFailure(path, {
      message,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(message);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && options?.onUnauthorized && !retried) {
    const nextToken = await options.onUnauthorized();
    if (!nextToken) {
      logSipayHttpFailure(path, {
        httpStatus: 401,
        message: "Sipay unauthorized and token refresh stopped",
        requestContext: options?.requestBody,
      });
      throw new SipayNetworkError("Sipay unauthorized and token refresh stopped", 401);
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${nextToken}`);
    return executePost<T>(
      url,
      path,
      { ...init, headers },
      options,
      true
    );
  }

  if (!response.ok) {
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message: `Sipay HTTP ${response.status} on ${path}`,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(`Sipay HTTP ${response.status} on ${path}`, response.status);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    const message = `Sipay response too large (${contentLength} bytes)`;
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(message);
  }

  const text = await response.text();
  if (text.length === 0) {
    const message = `Sipay empty response from ${path}`;
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(message);
  }
  if (text.length > MAX_RESPONSE_BYTES) {
    const message = "Sipay response body too large";
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(message);
  }

  try {
    const parsed = JSON.parse(text) as T;
    logSipayHttpResponse(path, parsed, response.status);
    return parsed;
  } catch {
    const message = `Sipay returned non-JSON response from ${path}`;
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
      requestContext: options?.requestBody,
    });
    throw new SipayNetworkError(message);
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
  logSipayHttpRequest(path, body);
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
    { ...options, requestBody: body },
  );
}

// Token endpoint uses form-encoded body (no auth token required)
export async function sipayPostToken<T>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = buildSipayUrl(baseUrl, path);
  logSipayHttpRequest(path, body);
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
      const message = "Sipay token request timed out";
      logSipayHttpFailure(path, { message });
      throw new SipayNetworkError(message);
    }
    const message = `Sipay token request failed: ${String(err)}`;
    logSipayHttpFailure(path, { message });
    throw new SipayNetworkError(message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message: `Sipay token HTTP ${response.status}`,
    });
    throw new SipayNetworkError(`Sipay token HTTP ${response.status}`, response.status);
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    const message = "Sipay token response body too large";
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
    });
    throw new SipayNetworkError(message);
  }

  try {
    const parsed = JSON.parse(text) as T;
    logSipayHttpResponse(path, parsed, response.status);
    return parsed;
  } catch {
    const message = "Sipay token returned non-JSON response";
    logSipayHttpFailure(path, {
      httpStatus: response.status,
      message,
    });
    throw new SipayNetworkError(message);
  }
}
