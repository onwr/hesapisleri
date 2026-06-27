import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { decimalToXmlAmount } from "@/lib/e-document/ubl-tr/decimal-format";
import { escapeXml } from "@/lib/e-document/ubl-tr/xml-escape";
import { normalizeTaxId } from "@/lib/e-document/ubl-tr/tax-id";
import { resolveUnitCode } from "@/lib/e-document/ubl-tr/unit-codes";
import { mapSellerParty, mapBuyerParty } from "@/lib/e-document/ubl-tr/party-mapper";
import { mapInvoiceLines } from "@/lib/e-document/ubl-tr/line-mapper";
import { validateInvoiceTotals } from "@/lib/e-document/ubl-tr/totals-validator";
import { buildUblTrInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-invoice-builder";
import { validateUblInvoiceXml } from "@/lib/e-document/ubl-tr/ubl-xsd-validator";
import {
  normalizeTaxpayerFromAliases,
  parseGibUserListXml,
} from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { resolveProfileId } from "@/lib/e-document/e-document-preview-helpers";
import {
  buildSovosCapabilitiesFromTestOutcomes,
} from "@/lib/e-document/sovos-capabilities";

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
    suspendedAt: null,
    suspendedReason: null,
    suspendedUntil: null,
    suspendedByUserId: null,
    archivedAt: null,
    archivedByUserId: null,
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

function baseItem(overrides: Partial<Record<string, unknown>> = {}) {
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

describe("ubl-tr decimal format", () => {
  it("decimal format 123.45", () => {
    assert.equal(decimalToXmlAmount(d("123.45")), "123.45");
    assert.equal(decimalToXmlAmount("123,45"), "123.45");
  });

  it("scientific notation reddedilir", () => {
    assert.throws(() => decimalToXmlAmount("1e3"));
  });
});

describe("ubl-tr tax id", () => {
  it("VKN 10 hane", () => {
    const result = normalizeTaxId("1234567890");
    assert.equal(result.ok && result.kind, "VKN");
  });

  it("TCKN 11 hane", () => {
    const result = normalizeTaxId("12345678901");
    assert.equal(result.ok && result.kind, "TCKN");
  });
});

describe("ubl-tr xml escaping", () => {
  it("xml escaping", () => {
    assert.equal(escapeXml(`A & B <C>`), "A &amp; B &lt;C&gt;");
  });
});

describe("ubl-tr unit codes", () => {
  it("bilinmeyen birim fallback yapmaz", () => {
    const result = resolveUnitCode("koli");
    assert.equal(result.ok, false);
  });
});

describe("ubl-tr profiles", () => {
  it("TEMELFATURA", () => {
    assert.equal(resolveProfileId("E_INVOICE", false), "TEMELFATURA");
  });

  it("TICARIFATURA", () => {
    assert.equal(resolveProfileId("E_INVOICE", true), "TICARIFATURA");
  });

  it("EARSIVFATURA", () => {
    assert.equal(resolveProfileId("E_ARCHIVE"), "EARSIVFATURA");
  });
});

describe("ubl-tr invoice builder", () => {
  it("geçerli xml üretir", () => {
    const seller = mapSellerParty(baseCompany());
    const buyer = mapBuyerParty(baseCustomer());
    const { lines } = mapInvoiceLines([baseItem()]);
    assert.ok(seller.party && buyer.party);

    const built = buildUblTrInvoiceXml({
      invoice: baseInvoice(),
      seller: seller.party,
      buyer: buyer.party,
      lines,
      profileId: "TEMELFATURA",
      invoiceTypeCode: "SATIS",
    });

    assert.match(built.xml, /ProfileID>TEMELFATURA</);
    assert.match(built.xml, /InvoiceTypeCode>SATIS</);
    assert.match(built.xml, /ext:UBLExtensions/);
    const xsd = validateUblInvoiceXml(built.xml, { profile: "transport", expectedLineCount: 1 });
    assert.equal(xsd.schemaLoaded, true);
    assert.doesNotMatch(built.xml, /<cac:Signature/);
  });
});

describe("ubl-tr totals validation", () => {
  it("toplam uyuşmazlığı", () => {
    const invoice = baseInvoice();
    invoice.total = d("999.00");
    const result = validateInvoiceTotals(invoice, [baseItem()]);
    assert.equal(result.ok, false);
  });
});

describe("taxpayer normalization", () => {
  it("çoklu alias", () => {
    const aliases = parseGibUserListXml(`
      <User><Identifier>urn:mail:a@gb.com</Identifier><Type>PK</Type><Title>A</Title></User>
      <User><Identifier>urn:mail:b@gb.com</Identifier><Type>PK</Type><Title>B</Title></User>
    `);
    const result = normalizeTaxpayerFromAliases("1234567890", aliases);
    assert.equal(result.activePkAliases.length, 2);
    assert.equal(result.recommendedDocumentType, "E_INVOICE");
  });

  it("kayıtlı olmayan mükellef", () => {
    const result = normalizeTaxpayerFromAliases("1234567890", []);
    assert.equal(result.registered, false);
    assert.equal(result.recommendedDocumentType, "E_ARCHIVE");
  });
});

describe("sovos capabilities semantics", () => {
  it("mock test verified sayılmaz", () => {
    const capabilities = buildSovosCapabilitiesFromTestOutcomes({
      credentials: {
        hasInvoiceCredentials: true,
        hasArchiveCredentials: true,
        hasDespatchCredentials: false,
      },
      outcomes: [
        { service: "eInvoice", ok: true, skipped: false },
        { service: "eArchive", ok: true, skipped: false },
      ],
      verificationMode: "mock",
    });
    assert.equal(capabilities.eInvoice.mockTested, true);
    assert.equal(capabilities.eInvoice.verified, false);
  });
});

describe("snapshot validation", () => {
  it("eksik müşteri snapshotı", () => {
    const buyer = mapBuyerParty(null);
    assert.equal(buyer.party, null);
    assert.match(buyer.issues[0]?.message ?? "", /müşteri/i);
  });
});
