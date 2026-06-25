import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type { EfaturamEnvironment } from "@prisma/client";

export type SovosAuthMethod = "HTTP_BASIC";

export type SovosSoapVersion = "1.1" | "1.2";

export type SovosOperationContract = {
  name: string;
  soapAction: string;
  requestElement: string;
  responseElement: string;
  requestNamespace: string;
  faultElement: string;
  requestFields: string[];
  responseFields: string[];
};

export type SovosServiceContract = {
  wsdlFile: string;
  targetNamespace: string;
  soapVersion: SovosSoapVersion;
  auth: {
    method: SovosAuthMethod;
    transport: "HTTPS";
    port: 443;
    header: "Authorization";
    scheme: "Basic";
    credentialSource: string;
    notes: string[];
  };
  endpoint: {
    documentedPathPattern: string;
    wsdlSuffix: string;
    assignment: string;
    envKeys: {
      test: string;
      live: string;
    };
  };
  connectionTest: SovosOperationContract;
  faults: Array<{
    element: string;
    fields: string[];
  }>;
  operations: SovosOperationContract[];
  hash?: {
    sendInvoice: string;
    signedInvoice: string;
    notes: string[];
  };
  branch?: {
    field: string;
    usage: string;
  };
};

export type SovosContractManifest = {
  generatedAt: string;
  documentVersion: string;
  sources: Array<{ filename: string; sha256: string; bytes: number }>;
  invoice: SovosServiceContract;
  archive: SovosServiceContract;
  despatch: SovosServiceContract;
  notes: string[];
};

const INVOICE_NS = "http:/fitcons.com/eInvoice/";
const ARCHIVE_INVOICE_NS = "http://fitcons.com/earchive/invoice";
const ARCHIVE_USERLIST_NS = "http:/fitcons.com/earchive/getuserlist";
const DESPATCH_NS = "http://foriba.com/eDespatch/";

export const SOVOS_DOCUMENTED_CONTRACT: Omit<
  SovosContractManifest,
  "generatedAt" | "sources"
> = {
  documentVersion: "2.3",
  invoice: {
    wsdlFile: "ClientEInvoiceServices-2.2.wsdl",
    targetNamespace: INVOICE_NS,
    soapVersion: "1.1",
    auth: {
      method: "HTTP_BASIC",
      transport: "HTTPS",
      port: 443,
      header: "Authorization",
      scheme: "Basic",
      credentialSource: "VKN/TCKN tabanlı web servis kullanıcı adı ve şifre",
      notes: [
        "Doküman: HTTP Basic Authentication (WS-Security değil).",
        "401 Unauthorized: kullanıcı adı/şifre veya başvuru formu kontrolü.",
      ],
    },
    endpoint: {
      documentedPathPattern:
        "https://<musteri-servis-adresi>/ClientEInvoiceServices/ClientEInvoiceServicesPort.svc",
      wsdlSuffix: "?wsdl",
      assignment:
        "WSDL içinde placeholder; gerçek test/canlı adres müşteriye Sovos tarafından verilir.",
      envKeys: {
        test: "SOVOS_INVOICE_ENDPOINT_TEST",
        live: "SOVOS_INVOICE_ENDPOINT_LIVE",
      },
    },
    connectionTest: {
      name: "getRAWUserList",
      soapAction: "getRAWUserList",
      requestElement: "getRAWUserListRequest",
      responseElement: "getRAWUserListResponse",
      requestNamespace: INVOICE_NS,
      faultElement: "ProcessingFault",
      requestFields: ["Identifier", "VKN_TCKN", "Role"],
      responseFields: ["DocData"],
    },
    faults: [
      {
        element: "ProcessingFault",
        fields: ["Code", "Message"],
      },
    ],
    operations: [
      {
        name: "getRAWUserList",
        soapAction: "getRAWUserList",
        requestElement: "getRAWUserListRequest",
        responseElement: "getRAWUserListResponse",
        requestNamespace: INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: ["Identifier", "VKN_TCKN", "Role"],
        responseFields: ["DocData"],
      },
      {
        name: "getPartialUserList",
        soapAction: "getPartialUserList",
        requestElement: "getPartialUserListRequest",
        responseElement: "getPartialUserListResponse",
        requestNamespace: INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: [
          "Identifier",
          "VKN_TCKN",
          "Role",
          "IncludeBinary",
          "FileNameList",
          "Parameters",
        ],
        responseFields: ["metaData", "userListPart"],
      },
      {
        name: "sendUBL",
        soapAction: "sendUBL",
        requestElement: "sendUBLRequest",
        responseElement: "sendUBLResponse",
        requestNamespace: INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: [
          "VKN_TCKN",
          "SenderIdentifier",
          "ReceiverIdentifier",
          "DocType",
          "DocData",
          "Parameters",
        ],
        responseFields: ["Response"],
      },
    ],
  },
  archive: {
    wsdlFile: "EArchiveInvoiceService_v2.wsdl",
    targetNamespace: ARCHIVE_INVOICE_NS,
    soapVersion: "1.1",
    auth: {
      method: "HTTP_BASIC",
      transport: "HTTPS",
      port: 443,
      header: "Authorization",
      scheme: "Basic",
      credentialSource: "VKN/TCKN tabanlı e-Arşiv web servis kullanıcı adı ve şifre",
      notes: ["Doküman: HTTP Basic Authentication."],
    },
    endpoint: {
      documentedPathPattern:
        "https://<musteri-servis-adresi>/ClientEArsivServicesPort.svc",
      wsdlSuffix: "?wsdl",
      assignment:
        "WSDL adresi 'no address'; gerçek test/canlı adres müşteriye Sovos tarafından verilir.",
      envKeys: {
        test: "SOVOS_ARCHIVE_ENDPOINT_TEST",
        live: "SOVOS_ARCHIVE_ENDPOINT_LIVE",
      },
    },
    connectionTest: {
      name: "getUserList",
      soapAction: "getUserList",
      requestElement: "getUserListRequest",
      responseElement: "getUserListResponse",
      requestNamespace: ARCHIVE_USERLIST_NS,
      faultElement: "getUserListFault",
      requestFields: ["vknTckn"],
      responseFields: ["binaryData"],
    },
    faults: [
      {
        element: "getUserListFault",
        fields: ["code", "message"],
      },
    ],
    hash: {
      sendInvoice: "MD5 (ziplenmiş e-Arşiv fatura)",
      signedInvoice: "SHA-256 (imzalı e-Arşiv fatura)",
      notes: [
        "sendInvoiceRequestType.hash alanı opsiyonel MD5.",
        "getSignedInvoice SHA-256 hash kullanır.",
      ],
    },
    branch: {
      field: "customizationParams.paramName=BRANCH",
      usage: "sendInvoice/sendEnvelope isteğinde şube kodu (ör. default).",
    },
    operations: [
      {
        name: "sendInvoice",
        soapAction: "sendInvoice",
        requestElement: "sendInvoiceRequestType",
        responseElement: "sendInvoiceResponseType",
        requestNamespace: ARCHIVE_INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: [
          "senderID",
          "receiverID",
          "docType",
          "fileName",
          "hash",
          "binaryData",
          "customizationParams",
          "responsiveOutput",
        ],
        responseFields: ["Detail", "Result", "preCheckErrorResults", "preCheckSuccessResults"],
      },
      {
        name: "getUserList",
        soapAction: "getUserList",
        requestElement: "getUserListRequest",
        responseElement: "getUserListResponse",
        requestNamespace: ARCHIVE_USERLIST_NS,
        faultElement: "getUserListFault",
        requestFields: ["vknTckn"],
        responseFields: ["binaryData"],
      },
      {
        name: "getStatus",
        soapAction: "getStatus",
        requestElement: "getStatusRequestType",
        responseElement: "getStatusResponseType",
        requestNamespace: ARCHIVE_INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: ["UUID", "vkn", "invoiceNumber", "custInvID"],
        responseFields: ["status", "statusDescription", "Result"],
      },
      {
        name: "cancelInvoice",
        soapAction: "cancelInvoice",
        requestElement: "cancelInvoiceRequest",
        responseElement: "invoiceCancellationServiceResponseType",
        requestNamespace: "http://fitcons.com/earchive/invoicecancellation",
        faultElement: "ProcessingFault",
        requestFields: ["invoiceID", "vkn", "branch", "totalAmount", "cancelDate"],
        responseFields: ["Result", "Detail"],
      },
      {
        name: "retriggerOperation",
        soapAction: "retriggerOperation",
        requestElement: "retriggerOperationRequest",
        responseElement: "retriggerOperationResponse",
        requestNamespace: ARCHIVE_INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: ["invoiceUUID", "vkn", "branch"],
        responseFields: ["Result", "Detail"],
      },
      {
        name: "getInvoiceDocument",
        soapAction: "getInvoiceDocument",
        requestElement: "getInvoiceDocumentRequest",
        responseElement: "getInvoiceDocumentResponseType",
        requestNamespace: ARCHIVE_INVOICE_NS,
        faultElement: "ProcessingFault",
        requestFields: ["UUID", "vkn", "invoiceNumber", "custInvID", "outputType"],
        responseFields: ["binaryData", "Result", "Detail"],
      },
    ],
  },
  despatch: {
    wsdlFile: "ClientEDespatchServices-1.1.wsdl",
    targetNamespace: DESPATCH_NS,
    soapVersion: "1.1",
    auth: {
      method: "HTTP_BASIC",
      transport: "HTTPS",
      port: 443,
      header: "Authorization",
      scheme: "Basic",
      credentialSource: "VKN/TCKN tabanlı e-İrsaliye web servis kullanıcı adı ve şifre",
      notes: ["Doküman: HTTP Basic Authentication."],
    },
    endpoint: {
      documentedPathPattern:
        "https://<musteri-servis-adresi>/ClientEDespatchServices/ClientEDespatchServicesPort.svc",
      wsdlSuffix: "?wsdl",
      assignment:
        "WSDL placeholder; test/canlı adres müşteriye Sovos tarafından verilir.",
      envKeys: {
        test: "SOVOS_DESPATCH_ENDPOINT_TEST",
        live: "SOVOS_DESPATCH_ENDPOINT_LIVE",
      },
    },
    connectionTest: {
      name: "getDesUserList",
      soapAction: "getDesUserList",
      requestElement: "getDesUserListRequest",
      responseElement: "getDesUserListResponse",
      requestNamespace: DESPATCH_NS,
      faultElement: "ProcessingFault",
      requestFields: ["Identifier", "VKN_TCKN", "Role"],
      responseFields: ["DocData"],
    },
    faults: [
      {
        element: "ProcessingFault",
        fields: ["Code", "Message"],
      },
    ],
    operations: [
      {
        name: "getDesUserList",
        soapAction: "getDesUserList",
        requestElement: "getDesUserListRequest",
        responseElement: "getDesUserListResponse",
        requestNamespace: DESPATCH_NS,
        faultElement: "ProcessingFault",
        requestFields: ["Identifier", "VKN_TCKN", "Role"],
        responseFields: ["DocData"],
      },
      {
        name: "sendDesUBL",
        soapAction: "sendDesUBL",
        requestElement: "sendDesUBLRequest",
        responseElement: "sendDesUBLResponse",
        requestNamespace: DESPATCH_NS,
        faultElement: "ProcessingFault",
        requestFields: [
          "VKN_TCKN",
          "SenderIdentifier",
          "ReceiverIdentifier",
          "DocType",
          "DocData",
        ],
        responseFields: ["Response"],
      },
    ],
  },
  notes: [
    "Gerçek test/canlı servis URL'leri resmî paketlerde müşteriye özel verilir; WSDL placeholder içerir.",
    "Endpoint yapılandırması için SOVOS_*_ENDPOINT_TEST / SOVOS_*_ENDPOINT_LIVE ortam değişkenleri kullanılır.",
    "E-Fatura mükellef sorgusu bağlantı testi: getRAWUserList (kendi VKN/TCKN). getPartialUserList tam liste parçaları içindir.",
    "E-Arşiv bağlantı testi: getUserList (yalnızca vknTckn).",
  ],
};

let cachedManifest: SovosContractManifest | null = null;

export function loadSovosContractManifest(): SovosContractManifest {
  if (cachedManifest) return cachedManifest;

  const manifestPath = path.join(process.cwd(), "generated", "sovos-contract-manifest.json");
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<SovosContractManifest>;
    cachedManifest = {
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
      documentVersion: raw.documentVersion ?? SOVOS_DOCUMENTED_CONTRACT.documentVersion,
      sources: raw.sources ?? [],
      invoice: { ...SOVOS_DOCUMENTED_CONTRACT.invoice, ...(raw.invoice as object) },
      archive: { ...SOVOS_DOCUMENTED_CONTRACT.archive, ...(raw.archive as object) },
      despatch: { ...SOVOS_DOCUMENTED_CONTRACT.despatch, ...(raw.despatch as object) },
      notes: [...SOVOS_DOCUMENTED_CONTRACT.notes, ...(raw.notes ?? [])],
    };
  } catch {
    cachedManifest = {
      generatedAt: new Date().toISOString(),
      ...SOVOS_DOCUMENTED_CONTRACT,
      sources: [],
    };
  }

  return cachedManifest;
}

export function resolveSovosServiceEndpoint(
  service: keyof Pick<SovosContractManifest, "invoice" | "archive" | "despatch">,
  environment: EfaturamEnvironment
): string | null {
  const contract = loadSovosContractManifest()[service];
  const key =
    environment === "LIVE"
      ? contract.endpoint.envKeys.live
      : contract.endpoint.envKeys.test;
  const value = process.env[key]?.trim();
  return value || null;
}

export function resolveSovosWsdlUrl(
  service: keyof Pick<SovosContractManifest, "invoice" | "archive" | "despatch">,
  environment: EfaturamEnvironment
): string | null {
  const endpoint = resolveSovosServiceEndpoint(service, environment);
  if (!endpoint) return null;
  const suffix = loadSovosContractManifest()[service].endpoint.wsdlSuffix;
  return endpoint.includes("?") ? endpoint : `${endpoint}${suffix}`;
}
