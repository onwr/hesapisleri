import type { Company, Customer, Invoice, InvoiceItem } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  InvoiceEDocumentSnapshots,
  InvoiceInternetSaleSnapshot,
  InvoiceLineSnapshot,
  SnapshotFieldIssue,
  SnapshotResolveResult,
} from "@/lib/e-document/invoice-e-document-snapshot-types";
import {
  computeInvoiceRevisionHash,
  computeSnapshotContentHash,
} from "@/lib/e-document/invoice-revision-hash";
import { decimalFieldToXml } from "@/lib/e-document/ubl-tr/minor-units";
import { normalizeTaxId } from "@/lib/e-document/ubl-tr/tax-id";
import { resolveUnitCode } from "@/lib/e-document/ubl-tr/unit-codes";
import { db } from "@/lib/prisma";

export { computeInvoiceRevisionHash, computeSnapshotContentHash };

function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? name, familyName: "-" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    familyName: parts[parts.length - 1]!,
  };
}

function parseAddressParts(address: string | null | undefined) {
  const raw = address?.trim() ?? "";
  if (!raw) {
    return { street: undefined, district: undefined, city: undefined, postalZone: undefined };
  }

  const segments = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 3) {
    return {
      street: segments[0],
      district: segments[1],
      city: segments[2],
      postalZone: segments[3],
    };
  }

  return {
    street: raw,
    district: undefined,
    city: undefined,
    postalZone: undefined,
  };
}

function buildPartySnapshotFromCompany(company: Company, prefix: "seller") {
  const issues: SnapshotFieldIssue[] = [];
  const tax = normalizeTaxId(company.taxNo);
  if (!tax.ok) issues.push({ field: `${prefix}.taxId`, message: tax.message });

  const name = company.name?.trim();
  if (!name) issues.push({ field: `${prefix}.name`, message: "Satıcı unvanı zorunludur." });
  if (!company.taxOffice?.trim()) {
    issues.push({ field: `${prefix}.taxOffice`, message: "Satıcı vergi dairesi zorunludur." });
  }

  const address = parseAddressParts(company.address);
  if (!address.street) issues.push({ field: `${prefix}.address`, message: "Satıcı adresi zorunludur." });
  if (!address.city) {
    issues.push({
      field: `${prefix}.city`,
      message: "Satıcı il bilgisi zorunludur (adres içinde virgülle ayırın).",
    });
  }
  if (!address.district) {
    issues.push({
      field: `${prefix}.district`,
      message: "Satıcı ilçe bilgisi zorunludur (adres içinde virgülle ayırın).",
    });
  }

  if (!tax.ok || !name) return { snapshot: null, issues };

  const person = tax.kind === "TCKN" ? splitPersonName(name) : null;
  return {
    snapshot: {
      taxId: tax.taxId,
      taxIdKind: tax.kind,
      taxOffice: company.taxOffice?.trim() || undefined,
      title: tax.kind === "VKN" ? name : undefined,
      firstName: person?.firstName,
      familyName: person?.familyName,
      street: address.street,
      city: address.city,
      district: address.district,
      postalZone: address.postalZone,
      countryCode: "TR",
      phone: company.phone?.trim() || undefined,
      email: company.email?.trim() || undefined,
    },
    issues,
  };
}

function buildPartySnapshotFromCustomer(customer: Customer | null, prefix: "buyer") {
  const issues: SnapshotFieldIssue[] = [];
  if (!customer) {
    issues.push({ field: `${prefix}.customer`, message: "Alıcı müşteri kaydı zorunludur." });
    return { snapshot: null, issues };
  }

  const tax = normalizeTaxId(customer.taxNo);
  if (!tax.ok) issues.push({ field: `${prefix}.taxId`, message: tax.message });

  const name = customer.name?.trim();
  if (!name) issues.push({ field: `${prefix}.name`, message: "Alıcı adı/unvanı zorunludur." });
  if (!customer.taxOffice?.trim()) {
    issues.push({ field: `${prefix}.taxOffice`, message: "Alıcı vergi dairesi zorunludur." });
  }

  const address = parseAddressParts(customer.address);
  if (!address.street) issues.push({ field: `${prefix}.address`, message: "Alıcı adresi zorunludur." });
  if (!address.city) {
    issues.push({
      field: `${prefix}.city`,
      message: "Alıcı il bilgisi zorunludur (adres içinde virgülle ayırın).",
    });
  }
  if (!address.district) {
    issues.push({
      field: `${prefix}.district`,
      message: "Alıcı ilçe bilgisi zorunludur (adres içinde virgülle ayırın).",
    });
  }

  if (!tax.ok || !name) return { snapshot: null, issues };

  const person = tax.kind === "TCKN" ? splitPersonName(name) : null;
  return {
    snapshot: {
      taxId: tax.taxId,
      taxIdKind: tax.kind,
      taxOffice: customer.taxOffice?.trim() || undefined,
      title: tax.kind === "VKN" ? name : undefined,
      firstName: person?.firstName,
      familyName: person?.familyName,
      street: address.street,
      city: address.city,
      district: address.district,
      postalZone: address.postalZone,
      countryCode: "TR",
      phone: customer.phone?.trim() || undefined,
      email: customer.email?.trim() || undefined,
    },
    issues,
  };
}

function buildLineSnapshots(items: InvoiceItem[]) {
  const issues: SnapshotFieldIssue[] = [];
  const snapshots: InvoiceLineSnapshot[] = [];
  const sorted = items.slice().sort((a, b) => a.lineIndex - b.lineIndex);

  for (const [index, item] of sorted.entries()) {
    const lineNo = item.lineIndex || index + 1;
    const productName = item.productName?.trim();
    if (!productName) {
      issues.push({
        field: "line.productName",
        message: "Ürün adı snapshot alanı zorunludur.",
        lineIndex: lineNo,
      });
      continue;
    }

    const unit = resolveUnitCode(item.unit);
    if (!unit.ok) {
      issues.push({ field: "line.unit", message: unit.message, lineIndex: lineNo });
      continue;
    }

    snapshots.push({
      lineIndex: lineNo,
      productName,
      description: item.description?.trim() || undefined,
      sku: item.sku?.trim() || undefined,
      barcode: item.barcode?.trim() || undefined,
      unit: unit.code,
      quantity: decimalFieldToXml(item.quantity),
      unitPrice: decimalFieldToXml(item.unitPrice),
      discountRate: decimalFieldToXml(item.discountRate),
      discountAmount: decimalFieldToXml(item.discountAmount),
      lineNetAmount: decimalFieldToXml(item.lineNetAmount),
      vatRate: decimalFieldToXml(item.vatRate),
      vatAmount: decimalFieldToXml(item.vatAmount),
      lineGrossAmount: decimalFieldToXml(item.lineGrossAmount),
    });
  }

  return { snapshots, issues };
}

function buildFinancialSnapshot(invoice: Invoice) {
  return {
    subtotal: decimalFieldToXml(invoice.subtotal),
    totalDiscount: decimalFieldToXml(invoice.totalDiscount),
    taxableAmount: decimalFieldToXml(invoice.taxableAmount),
    totalVat: decimalFieldToXml(invoice.totalVat),
    total: decimalFieldToXml(invoice.total),
    status: invoice.financialSnapshotStatus,
  };
}

export function readSnapshotsFromInvoice(invoice: Invoice): InvoiceEDocumentSnapshots {
  return {
    sellerSnapshot: (invoice.sellerSnapshot as InvoiceEDocumentSnapshots["sellerSnapshot"]) ?? null,
    buyerSnapshot: (invoice.buyerSnapshot as InvoiceEDocumentSnapshots["buyerSnapshot"]) ?? null,
    lineSnapshots: (invoice.lineSnapshots as InvoiceEDocumentSnapshots["lineSnapshots"]) ?? [],
    internetSaleSnapshot:
      (invoice.internetSaleSnapshot as InvoiceEDocumentSnapshots["internetSaleSnapshot"]) ?? null,
    financialSnapshot:
      (invoice.financialSnapshot as InvoiceEDocumentSnapshots["financialSnapshot"]) ?? null,
    eDocumentSnapshotAt: invoice.eDocumentSnapshotAt,
    status: invoice.eDocumentSnapshotStatus,
    revisionHash: invoice.eDocumentRevisionHash,
    snapshotHash: invoice.eDocumentSnapshotHash,
  };
}

export function hasCompleteSnapshots(snapshots: InvoiceEDocumentSnapshots): boolean {
  return Boolean(
    snapshots.sellerSnapshot &&
      snapshots.buyerSnapshot &&
      snapshots.lineSnapshots.length > 0 &&
      snapshots.financialSnapshot
  );
}

export function buildSnapshotsFromSources(input: {
  company: Company;
  customer: Customer | null;
  invoice: Invoice;
  items: InvoiceItem[];
  internetSale?: InvoiceInternetSaleSnapshot | null;
  revisionHash: string;
}) {
  const seller = buildPartySnapshotFromCompany(input.company, "seller");
  const buyer = buildPartySnapshotFromCustomer(input.customer, "buyer");
  const lines = buildLineSnapshots(input.items);
  const issues = [...seller.issues, ...buyer.issues, ...lines.issues];

  if (input.invoice.financialSnapshotStatus === "NEEDS_REVIEW") {
    issues.push({
      field: "financialSnapshotStatus",
      message: "Fatura finansal snapshot durumu tamamlanmamış (NEEDS_REVIEW).",
    });
  }

  const financialSnapshot = buildFinancialSnapshot(input.invoice);
  const snapshots: InvoiceEDocumentSnapshots = {
    sellerSnapshot: seller.snapshot,
    buyerSnapshot: buyer.snapshot,
    lineSnapshots: lines.snapshots,
    internetSaleSnapshot: input.internetSale ?? null,
    financialSnapshot,
    eDocumentSnapshotAt: null,
    status: null,
    revisionHash: input.revisionHash,
    snapshotHash: null,
  };

  if (hasCompleteSnapshots(snapshots)) {
    snapshots.snapshotHash = computeSnapshotContentHash(snapshots);
  }

  return {
    complete: issues.length === 0 && hasCompleteSnapshots(snapshots),
    issues,
    snapshots,
  };
}

function isSnapshotLocked(invoice: Invoice & { documentSubmission?: { status: string } | null }) {
  if (invoice.eDocumentSnapshotStatus === "LOCKED") return true;
  const submissionStatus = invoice.documentSubmission?.status;
  return submissionStatus === "SUCCESS" || submissionStatus === "PENDING";
}

async function persistPreviewSnapshots(
  invoiceId: string,
  snapshots: InvoiceEDocumentSnapshots,
  status: "PREVIEW" | "READY"
) {
  const now = new Date();
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      sellerSnapshot: snapshots.sellerSnapshot ?? Prisma.JsonNull,
      buyerSnapshot: snapshots.buyerSnapshot ?? Prisma.JsonNull,
      lineSnapshots: snapshots.lineSnapshots,
      internetSaleSnapshot: snapshots.internetSaleSnapshot ?? Prisma.JsonNull,
      financialSnapshot: snapshots.financialSnapshot ?? Prisma.JsonNull,
      eDocumentSnapshotAt: now,
      eDocumentSnapshotStatus: status,
      eDocumentRevisionHash: snapshots.revisionHash,
      eDocumentSnapshotHash: snapshots.snapshotHash,
    },
  });
  return { ...snapshots, eDocumentSnapshotAt: now, status };
}

export async function resolveInvoiceEDocumentSnapshots(input: {
  companyId: string;
  invoiceId: string;
  mode: "preview" | "prepare";
  internetSale?: InvoiceInternetSaleSnapshot | null;
}): Promise<SnapshotResolveResult> {
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, companyId: input.companyId },
    include: {
      company: true,
      customer: true,
      items: { orderBy: { lineIndex: "asc" } },
      documentSubmission: true,
    },
  });

  if (!invoice) {
    throw new Error("Fatura bulunamadı.");
  }

  const locked = isSnapshotLocked(invoice);
  const existing = readSnapshotsFromInvoice(invoice);

  if (locked) {
    return {
      snapshots: existing,
      issues: [],
      persisted: false,
      refreshed: false,
      locked: true,
      status: existing.status ?? "LOCKED",
    };
  }

  const revisionHash = computeInvoiceRevisionHash({ invoice, items: invoice.items });
  const revisionMatches = existing.revisionHash === revisionHash;
  if (revisionMatches && hasCompleteSnapshots(existing)) {
    return {
      snapshots: existing,
      issues: [],
      persisted: false,
      refreshed: false,
      locked: false,
      status: existing.status ?? "PREVIEW",
    };
  }

  const built = buildSnapshotsFromSources({
    company: invoice.company,
    customer: invoice.customer,
    invoice,
    items: invoice.items,
    internetSale: input.internetSale ?? existing.internetSaleSnapshot,
    revisionHash,
  });

  if (!built.complete) {
    return {
      snapshots: built.snapshots,
      issues: built.issues,
      persisted: false,
      refreshed: true,
      locked: false,
      status: null,
    };
  }

  const targetStatus = input.mode === "prepare" ? "READY" : "PREVIEW";
  const persistedSnapshots = await persistPreviewSnapshots(invoice.id, built.snapshots, targetStatus);

  return {
    snapshots: persistedSnapshots,
    issues: [],
    persisted: true,
    refreshed: true,
    locked: false,
    status: targetStatus,
  };
}

/** Gönderim/submission anında çağrılır; snapshot immutable olur. */
export async function lockInvoiceEDocumentSnapshots(input: {
  companyId: string;
  invoiceId: string;
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, companyId: input.companyId },
  });
  if (!invoice) throw new Error("Fatura bulunamadı.");

  await db.invoice.update({
    where: { id: invoice.id },
    data: { eDocumentSnapshotStatus: "LOCKED" },
  });
}

/** @deprecated resolveInvoiceEDocumentSnapshots kullanın */
export async function ensureInvoiceEDocumentSnapshots(input: {
  companyId: string;
  invoiceId: string;
  internetSale?: InvoiceInternetSaleSnapshot | null;
}) {
  const result = await resolveInvoiceEDocumentSnapshots({
    ...input,
    mode: "preview",
  });
  return {
    snapshots: result.snapshots,
    issues: result.issues,
    persisted: result.persisted,
  };
}
