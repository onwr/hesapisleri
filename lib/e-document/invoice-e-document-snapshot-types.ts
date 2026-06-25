import type { EDocumentSnapshotStatus, FinancialSnapshotStatus } from "@prisma/client";

export type InvoicePartySnapshot = {
  taxId: string;
  taxIdKind: "VKN" | "TCKN";
  taxOffice?: string;
  title?: string;
  firstName?: string;
  familyName?: string;
  street?: string;
  city?: string;
  district?: string;
  postalZone?: string;
  countryCode: string;
  phone?: string;
  email?: string;
};

export type InvoiceLineSnapshot = {
  lineIndex: number;
  productName: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  discountAmount: string;
  lineNetAmount: string;
  vatRate: string;
  vatAmount: string;
  lineGrossAmount: string;
};

export type InvoiceInternetSaleSnapshot = {
  orderNumber?: string;
  orderDate?: string;
  webAddress?: string;
  paymentMethod?: string;
  paymentDate?: string;
  paymentAgent?: string;
  carrier?: string;
  shippingInfo?: string;
  deliveryInfo?: string;
};

export type InvoiceFinancialSnapshot = {
  subtotal: string;
  totalDiscount: string;
  taxableAmount: string;
  totalVat: string;
  total: string;
  status: FinancialSnapshotStatus;
};

export type InvoiceEDocumentSnapshots = {
  sellerSnapshot: InvoicePartySnapshot | null;
  buyerSnapshot: InvoicePartySnapshot | null;
  lineSnapshots: InvoiceLineSnapshot[];
  internetSaleSnapshot: InvoiceInternetSaleSnapshot | null;
  financialSnapshot: InvoiceFinancialSnapshot | null;
  eDocumentSnapshotAt: Date | null;
  status: EDocumentSnapshotStatus | null;
  revisionHash: string | null;
  snapshotHash: string | null;
};

export type SnapshotFieldIssue = {
  field: string;
  message: string;
  lineIndex?: number;
};

export type SnapshotBuildResult = {
  complete: boolean;
  snapshots: InvoiceEDocumentSnapshots;
  issues: SnapshotFieldIssue[];
};

export type SnapshotResolveResult = {
  snapshots: InvoiceEDocumentSnapshots;
  issues: SnapshotFieldIssue[];
  persisted: boolean;
  refreshed: boolean;
  locked: boolean;
  status: EDocumentSnapshotStatus | null;
};
