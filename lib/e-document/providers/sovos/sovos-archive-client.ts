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

export type SovosArchiveConnectionInput = {
  environment: EfaturamEnvironment;
  credentials: SovosAuthCredentials;
  taxId: string;
  endpointOverride?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function testSovosArchiveConnection(input: SovosArchiveConnectionInput) {
  const contract = loadSovosContractManifest().archive;
  const endpoint =
    input.endpointOverride?.trim() ||
    resolveSovosServiceEndpoint("archive", input.environment);

  if (!endpoint) {
    throw new SovosError(
      "ENDPOINT_NOT_CONFIGURED",
      "E-Arşiv Sovos endpoint yapılandırılmamış."
    );
  }

  const operation = contract.connectionTest;
  const bodyXml = `
    <get:${operation.requestElement} xmlns:get="${operation.requestNamespace}">
      <get:vknTckn>${xmlEscape(input.taxId.trim())}</get:vknTckn>
    </get:${operation.requestElement}>
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
      "E-Arşiv getUserList yanıtı beklenen formatta değil."
    );
  }

  return result;
}
