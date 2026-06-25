import "server-only";

import {
  buildSovosRequestHeaders,
  type SovosAuthCredentials,
} from "@/lib/e-document/providers/sovos/sovos-auth";
import {
  normalizeSovosHttpError,
  normalizeSovosTransportError,
  parseSoapFault,
  SovosError,
} from "@/lib/e-document/providers/sovos/sovos-errors";
import type { SovosSoapVersion } from "@/lib/e-document/providers/sovos/sovos-config";

export type SovosSoapCallInput = {
  endpoint: string;
  soapVersion: SovosSoapVersion;
  soapAction: string;
  bodyXml: string;
  credentials: SovosAuthCredentials;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type SovosSoapCallResult = {
  ok: boolean;
  status: number;
  body: string;
};

function buildEnvelope(bodyXml: string, soapVersion: SovosSoapVersion): string {
  if (soapVersion === "1.2") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header/>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    ${bodyXml}
  </soapenv:Body>
</soapenv:Envelope>`;
}

export async function callSovosSoap(input: SovosSoapCallInput): Promise<SovosSoapCallResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const envelope = buildEnvelope(input.bodyXml, input.soapVersion);
  const headers = buildSovosRequestHeaders(input.credentials, input.soapAction);

  try {
    const response = await fetchImpl(input.endpoint, {
      method: "POST",
      headers,
      body: envelope,
      signal: controller.signal,
    });

    const body = await response.text();

    if (!response.ok) {
      throw normalizeSovosHttpError(response.status, body);
    }

    const fault = parseSoapFault(body);
    if (fault) {
      throw new SovosError("SOAP_FAULT", fault.message, { faultCode: fault.code });
    }

    return { ok: true, status: response.status, body };
  } catch (error) {
    if (error instanceof SovosError) throw error;
    throw normalizeSovosTransportError(error);
  } finally {
    clearTimeout(timer);
  }
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function hasResponseElement(body: string, elementName: string): boolean {
  return new RegExp(`<(?:[\\w-]+:)?${elementName}\\b`, "i").test(body);
}
