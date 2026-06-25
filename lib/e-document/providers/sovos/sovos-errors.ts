import "server-only";

import { redactSovosSecrets } from "@/lib/e-document/providers/sovos/sovos-auth";

export type SovosErrorCode =
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED_SERVICE"
  | "IP_BLOCKED"
  | "SOAP_FAULT"
  | "TIMEOUT"
  | "WRONG_ENDPOINT"
  | "WSDL_CONFIG_ERROR"
  | "ENDPOINT_NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class SovosError extends Error {
  readonly code: SovosErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly faultCode?: string;

  constructor(
    code: SovosErrorCode,
    message: string,
    options?: { retryable?: boolean; httpStatus?: number; faultCode?: string; cause?: unknown }
  ) {
    super(redactSovosSecrets(message));
    this.name = "SovosError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.httpStatus = options?.httpStatus;
    this.faultCode = options?.faultCode;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export function parseSoapFault(xml: string): { code?: string; message: string } | null {
  const faultMatch = xml.match(/<(?:[\w-]+:)?Fault[\s\S]*?<\/(?:[\w-]+:)?Fault>/i);
  if (!faultMatch) return null;

  const block = faultMatch[0];
  const faultString =
    block.match(/<(?:[\w-]+:)?faultstring[^>]*>([^<]*)</i)?.[1] ??
    block.match(/<(?:[\w-]+:)?Message[^>]*>([^<]*)</i)?.[1];
  const faultCode =
    block.match(/<(?:[\w-]+:)?Code[^>]*>([^<]*)</i)?.[1] ??
    block.match(/<(?:[\w-]+:)?code[^>]*>([^<]*)</i)?.[1];

  return {
    code: faultCode?.trim() || undefined,
    message: redactSovosSecrets(faultString?.trim() || "SOAP Fault"),
  };
}

export function normalizeSovosTransportError(error: unknown, context?: string): SovosError {
  if (error instanceof SovosError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactSovosSecrets(message);
  const prefix = context ? `${context}: ` : "";

  if (/abort|timeout|timed out|ETIMEDOUT/i.test(redacted)) {
    return new SovosError("TIMEOUT", `${prefix}Sovos servisine zaman aşımı.`, {
      retryable: true,
      cause: error,
    });
  }

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|network/i.test(redacted)) {
    return new SovosError("WRONG_ENDPOINT", `${prefix}Sovos servis adresine ulaşılamadı.`, {
      cause: error,
    });
  }

  return new SovosError("UNKNOWN", `${prefix}${redacted}`, { cause: error });
}

export function normalizeSovosHttpError(
  status: number,
  body: string,
  context?: string
): SovosError {
  const prefix = context ? `${context}: ` : "";
  const fault = parseSoapFault(body);

  if (status === 401) {
    return new SovosError(
      "INVALID_CREDENTIALS",
      `${prefix}Web servis kullanıcı adı veya şifre hatalı.`,
      { httpStatus: status }
    );
  }

  if (status === 403) {
    const code = /ip|address|engel/i.test(body) ? "IP_BLOCKED" : "UNAUTHORIZED_SERVICE";
    return new SovosError(
      code,
      code === "IP_BLOCKED"
        ? `${prefix}IP adresi Sovos tarafından engellenmiş olabilir.`
        : `${prefix}Bu servis için yetkiniz bulunmuyor.`,
      { httpStatus: status }
    );
  }

  if (fault) {
    return new SovosError("SOAP_FAULT", `${prefix}${fault.message}`, {
      httpStatus: status,
      faultCode: fault.code,
    });
  }

  if (status >= 500) {
    return new SovosError("NETWORK_ERROR", `${prefix}Sovos servisi geçici olarak kullanılamıyor.`, {
      httpStatus: status,
      retryable: true,
    });
  }

  return new SovosError(
    "UNKNOWN",
    `${prefix}Beklenmeyen HTTP ${status} yanıtı alındı.`,
    { httpStatus: status }
  );
}

export function userMessageForSovosError(error: SovosError): string {
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Sovos web servis kullanıcı adı veya şifre hatalı.";
    case "UNAUTHORIZED_SERVICE":
      return "Sovos web servis yetkisi bulunamadı.";
    case "IP_BLOCKED":
      return "Sunucu IP adresiniz Sovos tarafından engellenmiş olabilir.";
    case "SOAP_FAULT":
      return error.message;
    case "TIMEOUT":
      return "Sovos servisine bağlanırken zaman aşımı oluştu.";
    case "WRONG_ENDPOINT":
      return "Sovos servis adresine ulaşılamadı. Endpoint yapılandırmasını kontrol edin.";
    case "WSDL_CONFIG_ERROR":
      return "Sovos WSDL/sözleşme yapılandırması eksik.";
    case "ENDPOINT_NOT_CONFIGURED":
      return "Sovos servis adresi yapılandırılmamış. SOVOS_*_ENDPOINT ortam değişkenlerini tanımlayın.";
    default:
      return error.message;
  }
}
