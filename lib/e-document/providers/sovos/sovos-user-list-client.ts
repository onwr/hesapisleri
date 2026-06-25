import "server-only";

import {
  extractBase64PayloadFromSoap,
  extractXmlFromUserListZip,
} from "@/lib/e-document/taxpayer/gib-user-list-zip";
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

export type SovosUserListFetchInput = {
  environment: EfaturamEnvironment;
  credentials: SovosAuthCredentials;
  integratorTaxId: string;
  senderIdentifier?: string | null;
  role?: "GB" | "PK";
  endpointOverride?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function extractBase64Payload(soapBody: string, tagNames: string[]): Buffer | null {
  return extractBase64PayloadFromSoap(soapBody, tagNames);
}

export { extractXmlFromUserListZip };

export async function fetchSovosRawUserListZip(
  input: SovosUserListFetchInput
): Promise<{ zipBuffer: Buffer; soapBody: string }> {
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

  const operation = contract.operations.find((item) => item.name === "getRAWUserList");
  if (!operation) {
    throw new SovosError("WSDL_CONFIG_ERROR", "getRAWUserList operasyonu bulunamadı.");
  }

  const identifier =
    input.senderIdentifier?.trim() || `urn:mail:defaultgb@fitcons.com`;
  const role = input.role ?? "GB";

  const bodyXml = `
    <ein:${operation.requestElement} xmlns:ein="${operation.requestNamespace}">
      <ein:Identifier>${xmlEscape(identifier)}</ein:Identifier>
      <ein:VKN_TCKN>${xmlEscape(input.integratorTaxId.trim())}</ein:VKN_TCKN>
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
    timeoutMs: input.timeoutMs ?? 60_000,
  });

  if (!hasResponseElement(result.body, operation.responseElement)) {
    throw new SovosError(
      "SOAP_FAULT",
      "E-Fatura getRAWUserList yanıtı beklenen formatta değil."
    );
  }

  const zipBuffer = extractBase64Payload(result.body, ["DocData", "binaryData"]);
  if (!zipBuffer || zipBuffer.length === 0) {
    throw new SovosError("UNKNOWN", "GİB mükellef listesi boş döndü.");
  }

  return { zipBuffer, soapBody: result.body };
}

export async function fetchSovosUserListXmlParts(
  input: SovosUserListFetchInput
): Promise<string[]> {
  const { zipBuffer } = await fetchSovosRawUserListZip(input);
  return extractXmlFromUserListZip(zipBuffer);
}
