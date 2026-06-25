import "server-only";

import {
  loadSovosContractManifest,
  resolveSovosServiceEndpoint,
} from "@/lib/e-document/providers/sovos/sovos-config";
import type { SovosAuthCredentials } from "@/lib/e-document/providers/sovos/sovos-auth";
import { SovosError } from "@/lib/e-document/providers/sovos/sovos-errors";
import {
  callSovosSoap,
  hasResponseElement,
  xmlEscape,
} from "@/lib/e-document/providers/sovos/sovos-soap-client";
import type { EfaturamEnvironment } from "@prisma/client";

export type SovosInvoiceConnectionInput = {
  environment: EfaturamEnvironment;
  credentials: SovosAuthCredentials;
  taxId: string;
  senderIdentifier?: string | null;
  role?: "GB" | "PK";
  endpointOverride?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function testSovosInvoiceConnection(input: SovosInvoiceConnectionInput) {
  const contract = loadSovosContractManifest().invoice;
  const endpoint =
    input.endpointOverride?.trim() ||
    resolveSovosServiceEndpoint("invoice", input.environment);

  if (!endpoint) {
    throw new SovosError(
      "ENDPOINT_NOT_CONFIGURED",
      "E-Fatura Sovos endpoint yapılandırılmamış."
    );
  }

  const operation = contract.connectionTest;
  const identifier =
    input.senderIdentifier?.trim() || `urn:mail:defaultgb@fitcons.com`;
  const role = input.role ?? "GB";

  const bodyXml = `
    <ein:${operation.requestElement} xmlns:ein="${operation.requestNamespace}">
      <ein:Identifier>${xmlEscape(identifier)}</ein:Identifier>
      <ein:VKN_TCKN>${xmlEscape(input.taxId.trim())}</ein:VKN_TCKN>
      <ein:Role>${xmlEscape(role)}</ein:Role>
    </ein:${operation.requestElement}>
  `.trim();

  const result = await callSovosSoap({
    endpoint,
    soapVersion: contract.soapVersion,
    soapAction: operation.soapAction,
    bodyXml,
    credentials: input.credentials,
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
  });

  if (!hasResponseElement(result.body, operation.responseElement)) {
    throw new SovosError(
      "SOAP_FAULT",
      "E-Fatura getRAWUserList yanıtı beklenen formatta değil."
    );
  }

  return result;
}
