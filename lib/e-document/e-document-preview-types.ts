import type { EDocumentProvider } from "@prisma/client";
import type { UblInvoiceTypeCode, UblProfileId } from "@/lib/e-document/ubl-tr/ubl-tr-version";

export type EDocumentPreviewInput = {
  documentType?: "E_INVOICE" | "E_ARCHIVE";
  targetAlias?: string | null;
  internetSale?: boolean;
  invoiceTypeCode?: UblInvoiceTypeCode;
  commercialProfile?: boolean;
  internetSaleOrderNumber?: string;
  internetSaleOrderDate?: string;
  internetSaleWebAddress?: string;
  internetSalePaymentMethod?: string;
  internetSalePaymentDate?: string;
  internetSalePaymentAgent?: string;
  internetSaleCarrier?: string;
  internetSaleShippingInfo?: string;
  internetSaleDeliveryInfo?: string;
};

export type EDocumentFieldIssue = {
  field: string;
  message: string;
  lineIndex?: number;
};

export type EDocumentPreviewTaxpayerAlias = {
  alias: string;
  type?: string;
  title?: string;
  active: boolean;
};

export type EDocumentPreviewResult = {
  provider: EDocumentProvider | null;
  recommendedDocumentType: "E_INVOICE" | "E_ARCHIVE";
  profileId: UblProfileId | null;
  invoiceTypeCode: UblInvoiceTypeCode;
  selectedAlias: string | null;
  availableAliases: EDocumentPreviewTaxpayerAlias[];
  sellerIssues: EDocumentFieldIssue[];
  buyerIssues: EDocumentFieldIssue[];
  lineIssues: EDocumentFieldIssue[];
  internetSaleIssues: EDocumentFieldIssue[];
  snapshotIssues: EDocumentFieldIssue[];
  totalValidation: {
    ok: boolean;
    issues: EDocumentFieldIssue[];
  };
  xsdValidation: {
    ok: boolean;
    valid: boolean;
    schemaLoaded: boolean;
    issues: EDocumentFieldIssue[];
  };
  entitlement: {
    featureEnabled: boolean;
    limitReached: boolean;
    message: string | null;
  };
  taxpayerLookup: {
    syncOperation: string;
    lookupMethod: string;
    registered: boolean | null;
    title: string | null;
    status: string | null;
    providerError: string | null;
    cacheHit: boolean;
    staleCache: boolean;
  };
  snapshot: {
    ready: boolean;
    persisted: boolean;
    refreshed: boolean;
    locked: boolean;
    status: string | null;
    revisionHash: string | null;
    capturedAt: string | null;
  };
  identifiers: {
    previewUuid: string | null;
    custInvId: string | null;
  };
  sendable: boolean;
  xmlPreviewAvailable: boolean;
};
