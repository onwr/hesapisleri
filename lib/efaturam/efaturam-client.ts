import {
  getEfaturamGatewayUrl,
  type EfaturamEnvironment,
} from "@/lib/efaturam/efaturam-config";
import { parseEfaturamErrorBody } from "@/lib/efaturam/efaturam-error-utils";

export class EfaturamApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "EfaturamApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  environment: EfaturamEnvironment;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  accessToken?: string;
  body?: unknown;
  searchParams?: Record<string, string | undefined>;
};

export async function efaturamRequest<T>(options: RequestOptions): Promise<T> {
  const baseUrl = getEfaturamGatewayUrl(options.environment);
  const url = new URL(options.path, baseUrl);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { detail: text };
    }
  }

  if (!response.ok) {
    throw new EfaturamApiError(
      parseEfaturamErrorBody(parsed, "E-Faturam isteği başarısız."),
      response.status,
      parsed
    );
  }

  return (parsed ?? {}) as T;
}
