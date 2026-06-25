import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import AdmZip from "adm-zip";
import {
  buildSnapshotsFromSources,
  readSnapshotsFromInvoice,
  resolveInvoiceEDocumentSnapshots,
} from "@/lib/e-document/invoice-e-document-snapshot-service";
import { computeInvoiceRevisionHash } from "@/lib/e-document/invoice-revision-hash";
import { buildUblTrInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-invoice-builder";
import { mapSellerPartyFromSnapshot, mapBuyerPartyFromSnapshot } from "@/lib/e-document/ubl-tr/party-mapper";
import { mapInvoiceLinesFromSnapshots } from "@/lib/e-document/ubl-tr/line-mapper";
import { validateUblInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-xsd-validator";
import type { UblInvoiceTypeCode, UblProfileId } from "@/lib/e-document/ubl-tr/ubl-tr-version";
import {
  extractXmlFromUserListZip,
  GIB_USER_LIST_MAX_ZIP_BYTES,
  GibUserListZipError,
  validateGibUserListZipEntryName,
} from "@/lib/e-document/taxpayer/gib-user-list-zip";
import { getGibUserListIndex } from "@/lib/e-document/taxpayer/gib-user-list-sync-service";
import { db } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

const d = (value: string) => new Prisma.Decimal(value);

function baseCompany() {
  return {
    id: "c1",
    name: "Satıcı A.Ş.",
    taxNo: "1234567890",
    taxOffice: "Kadıköy",
    phone: "02121234567",
    email: "satis@ornek.com",
    address: "Caferağa Mah., Kadıköy, İstanbul",
    logoUrl: null,
    status: "ACTIVE" as const,
    referringPartnerId: null,
    referralCode: null,
    referredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function baseCustomer() {
  return {
    id: "cu1",
    companyId: "c1",
    name: "Alıcı Ltd.",
    phone: "02120000000",
    email: "alici@ornek.com",
    taxNo: "9876543210",
    taxOffice: "Üsküdar",
    taxCertificateUrl: null,
    taxCertificateFileName: null,
    taxCertificateMimeType: null,
    taxCertificateSize: null,
    address: "Bulgurlu Mah., Üsküdar, İstanbul",
    group: null,
    balance: d("0"),
    status: "ACTIVE" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    invoiceId: "inv1",
    productId: null,
    sourceSaleItemId: null,
    productName: "Ürün A",
    description: null,
    sku: null,
    barcode: null,
    unit: "Adet",
    quantity: d("2"),
    unitPrice: d("100.00"),
    discountRate: d("0"),
    discountAmount: d("0"),
    lineNetAmount: d("200.00"),
    vatRate: d("20"),
    vatAmount: d("40.00"),
    lineGrossAmount: d("240.00"),
    lineIndex: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseInvoice(items = [baseItem()]) {
  const taxable = items.reduce((sum, item) => sum.add(item.lineNetAmount), new Prisma.Decimal(0));
  const totalVat = items.reduce((sum, item) => sum.add(item.vatAmount), new Prisma.Decimal(0));
  const total = items.reduce((sum, item) => sum.add(item.lineGrossAmount), new Prisma.Decimal(0));
  return {
    id: "inv1",
    companyId: "c1",
    customerId: "cu1",
    saleId: null,
    invoiceNo: "INV-2026-001",
    type: "NORMAL" as const,
    status: "DRAFT" as const,
    subtotal: taxable,
    totalDiscount: d("0"),
    taxableAmount: taxable,
    totalVat,
    total,
    financialSnapshotStatus: "COMPLETE" as const,
    paymentStatus: "UNPAID" as const,
    paidAmount: d("0"),
    gibStatus: null,
    gibMessage: null,
    pdfUrl: null,
    xmlUrl: null,
    sellerSnapshot: null,
    buyerSnapshot: null,
    lineSnapshots: null,
    internetSaleSnapshot: null,
    financialSnapshot: null,
    eDocumentSnapshotAt: null,
    eDocumentSnapshotStatus: null,
    eDocumentRevisionHash: null,
    eDocumentSnapshotHash: null,
    dueDate: null,
    createdAt: new Date("2026-06-21T10:00:00.000Z"),
    updatedAt: new Date("2026-06-21T10:00:00.000Z"),
  };
}

function buildValidUbl(profileId: UblProfileId, invoiceTypeCode: UblInvoiceTypeCode) {
  const built = buildSnapshotsFromSources({
    company: baseCompany(),
    customer: baseCustomer(),
    invoice: baseInvoice(),
    items: [baseItem()],
    revisionHash: "rev",
  });
  const seller = mapSellerPartyFromSnapshot(built.snapshots.sellerSnapshot);
  const buyer = mapBuyerPartyFromSnapshot(built.snapshots.buyerSnapshot);
  const { lines } = mapInvoiceLinesFromSnapshots(built.snapshots.lineSnapshots);
  return buildUblTrInvoiceXml({
    invoice: baseInvoice(),
    seller: seller.party!,
    buyer: buyer.party!,
    lines,
    profileId,
    invoiceTypeCode,
  });
}

describe("faz 3.2 builder XSD", () => {
  const cases: Array<[UblProfileId, UblInvoiceTypeCode]> = [
    ["TEMELFATURA", "SATIS"],
    ["TICARIFATURA", "SATIS"],
    ["EARSIVFATURA", "SATIS"],
    ["TEMELFATURA", "IADE"],
    ["TICARIFATURA", "IADE"],
    ["EARSIVFATURA", "IADE"],
  ];

  for (const [profileId, invoiceTypeCode] of cases) {
    it(`${profileId} ${invoiceTypeCode} transport XSD geçer`, () => {
      const built = buildValidUbl(profileId, invoiceTypeCode);
      assert.doesNotMatch(built.xml, /<cac:Signature/);
      const xsd = validateUblInvoiceXml(built.xml, { profile: "transport", expectedLineCount: 1 });
      assert.equal(xsd.schemaLoaded, true, xsd.issues[0]?.message);
      assert.equal(xsd.valid, true, xsd.issues.map((i) => i.message).join("; "));
    });
  }
});

describe("faz 3.2 snapshot revision", () => {
  it("invoice değişince revision hash değişir", () => {
    const invoice = baseInvoice();
    const hash1 = computeInvoiceRevisionHash({ invoice, items: [baseItem()] });
    const hash2 = computeInvoiceRevisionHash({
      invoice: { ...invoice, total: d("999.00") },
      items: [baseItem()],
    });
    assert.notEqual(hash1, hash2);
  });

  it("invoice değişince preview snapshot yenilenir", async () => {
    const invoice = baseInvoice();
    const revisionHash = computeInvoiceRevisionHash({ invoice, items: [baseItem()] });
    const built = buildSnapshotsFromSources({
      company: baseCompany(),
      customer: baseCustomer(),
      invoice,
      items: [baseItem()],
      revisionHash,
    });

    let updateCalled = false;
    const originalFindFirst = db.invoice.findFirst;
    const originalUpdate = db.invoice.update;

    db.invoice.findFirst = (async () => ({
      ...invoice,
      total: d("999.00"),
      company: baseCompany(),
      customer: baseCustomer(),
      items: [baseItem()],
      documentSubmission: null,
      sellerSnapshot: built.snapshots.sellerSnapshot,
      buyerSnapshot: built.snapshots.buyerSnapshot,
      lineSnapshots: built.snapshots.lineSnapshots,
      financialSnapshot: built.snapshots.financialSnapshot,
      eDocumentSnapshotStatus: "PREVIEW" as const,
      eDocumentRevisionHash: revisionHash,
      eDocumentSnapshotHash: built.snapshots.snapshotHash,
    })) as unknown as typeof db.invoice.findFirst;

    db.invoice.update = (async () => {
      updateCalled = true;
      return invoice;
    }) as unknown as typeof db.invoice.update;

    try {
      const result = await resolveInvoiceEDocumentSnapshots({
        companyId: "c1",
        invoiceId: "inv1",
        mode: "preview",
      });
      assert.equal(result.refreshed, true);
      assert.equal(result.persisted, true);
      assert.equal(updateCalled, true);
      assert.equal(result.status, "PREVIEW");
    } finally {
      db.invoice.findFirst = originalFindFirst;
      db.invoice.update = originalUpdate;
    }
  });

  it("locked snapshot yenilenmez", async () => {
    const invoice = {
      ...baseInvoice(),
      eDocumentSnapshotStatus: "LOCKED" as const,
      sellerSnapshot: { taxId: "1234567890", taxIdKind: "VKN", title: "Eski", countryCode: "TR" },
      buyerSnapshot: { taxId: "9876543210", taxIdKind: "VKN", title: "Eski", countryCode: "TR" },
      lineSnapshots: [],
      financialSnapshot: { subtotal: "0", totalDiscount: "0", taxableAmount: "0", totalVat: "0", total: "0", status: "COMPLETE" },
      eDocumentRevisionHash: "old",
    };

    const findFirst = async () => ({
      ...invoice,
      company: baseCompany(),
      customer: baseCustomer(),
      items: [baseItem()],
      documentSubmission: { status: "SUCCESS" },
    });

    const original = db.invoice.findFirst;
    db.invoice.findFirst = findFirst as unknown as typeof db.invoice.findFirst;
    try {
      const result = await resolveInvoiceEDocumentSnapshots({
        companyId: "c1",
        invoiceId: "inv1",
        mode: "preview",
      });
      assert.equal(result.locked, true);
      assert.equal(result.refreshed, false);
      assert.equal((result.snapshots.sellerSnapshot as { title?: string })?.title, "Eski");
    } finally {
      db.invoice.findFirst = original;
    }
  });
});

describe("faz 3.2 gib user list zip security", () => {
  it("zip traversal reddedilir", () => {
    for (const unsafe of ["../evil.xml", "foo/../../evil.xml", "/etc/passwd", "\\evil.xml"]) {
      assert.throws(() => validateGibUserListZipEntryName(unsafe), GibUserListZipError);
    }
  });

  it("aşırı zip boyutu reddedilir", () => {
    assert.throws(
      () => extractXmlFromUserListZip(Buffer.alloc(GIB_USER_LIST_MAX_ZIP_BYTES + 1)),
      GibUserListZipError
    );
  });
});

describe("faz 3.2 migration modeli", () => {
  it("migration dosyası snapshot ve cache tablolarını içerir", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260626120000_invoice_e_document_snapshots/migration.sql"
      ),
      "utf8"
    );
    assert.match(sql, /sellerSnapshot/);
    assert.match(sql, /EDocumentGibUserListCache/);
    assert.match(sql, /EDocumentTaxpayerLookupCache/);
    assert.match(sql, /EDocumentSnapshotStatus/);
  });
});

describe("faz 3.2 stale cache", () => {
  it("sync başarısız olunca mevcut cache korunur", async () => {
    const staleIndex = { "1234567890": [{ alias: "urn:mail:pk@test.com", type: "PK", active: true }] };
    const originalFind = db.eDocumentGibUserListCache.findUnique;
    db.eDocumentGibUserListCache.findUnique = (async () => ({
      id: "cache1",
      companyId: "c1",
      syncOperation: "getRAWUserList",
      userIndex: staleIndex,
      syncedAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as unknown as typeof db.eDocumentGibUserListCache.findUnique;

    const originalUpsert = db.eDocumentGibUserListCache.upsert;
    let upsertCalled = false;
    db.eDocumentGibUserListCache.upsert = (async () => {
      upsertCalled = true;
      throw new Error("should not upsert on stale fallback path");
    }) as unknown as typeof db.eDocumentGibUserListCache.upsert;

    try {
      const result = await getGibUserListIndex({
        companyId: "c1",
        environment: "STAGE",
        credentials: {
          invoiceUsername: "bad",
          invoicePassword: "bad",
          archiveUsername: "bad",
          archivePassword: "bad",
          useSameArchiveCredentials: true,
        },
        integratorTaxId: "1234567890",
        allowStaleOnFailure: true,
      });

      assert.equal(result.providerError, "STALE_CACHE");
      assert.deepEqual(result.userIndex, staleIndex);
      assert.equal(upsertCalled, false);
    } finally {
      db.eDocumentGibUserListCache.findUnique = originalFind;
      db.eDocumentGibUserListCache.upsert = originalUpsert;
    }
  });
});
