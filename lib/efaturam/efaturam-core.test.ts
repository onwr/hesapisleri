import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invoiceMoneyToMinor } from "@/lib/efaturam/efaturam-money";
import { buildEfaturamDocumentPayload } from "@/lib/efaturam/efaturam-payload-builder";
import {
  normalizeTaxIdInput,
  parseTaxpayerLookupResponse,
  recommendDocumentTypeFromAliases,
} from "@/lib/efaturam/efaturam-taxpayer-utils";
import { translateEfaturamProblem } from "@/lib/efaturam/efaturam-error-utils";

describe("efaturam money", () => {
  it("decimal snapshot değerlerini kuruşa çevirir", () => {
    assert.equal(invoiceMoneyToMinor("479.00"), 47900);
    assert.equal(invoiceMoneyToMinor("12.5"), 1250);
    assert.equal(invoiceMoneyToMinor(100), 10000);
  });
});

describe("efaturam taxpayer", () => {
  it("aktif invoice alias varsa e-fatura önerir", () => {
    const result = recommendDocumentTypeFromAliases("1234567890", [
      { alias: "urn:mail:default@efatura.gov.tr", type: "INVOICE", active: true },
    ]);
    assert.equal(result.recommendedDocumentType, "E_INVOICE");
    assert.equal(result.activeInvoiceAliases.length, 1);
  });

  it("alias yoksa e-arşiv önerir", () => {
    const result = recommendDocumentTypeFromAliases("1234567890", []);
    assert.equal(result.recommendedDocumentType, "E_ARCHIVE");
  });

  it("VKN/TCKN normalize eder", () => {
    assert.equal(normalizeTaxIdInput("123 456 7890"), "1234567890");
  });

  it("mükellef yanıtını parse eder", () => {
    const parsed = parseTaxpayerLookupResponse("1234567890", {
      title: "Örnek A.Ş.",
      aliases: [{ alias: "pk@test.com", type: "INVOICE", active: true }],
    });
    assert.equal(parsed.title, "Örnek A.Ş.");
    assert.equal(parsed.recommendedDocumentType, "E_INVOICE");
  });
});

describe("efaturam payload builder", () => {
  it("fatura snapshotlarından kuruş payload üretir", () => {
    const payload = buildEfaturamDocumentPayload({
      invoice: {
        id: "inv_123",
        invoiceNo: "FTR-001",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        saleId: null,
        taxableAmount: "100.00" as unknown as never,
        totalVat: "20.00" as unknown as never,
        totalDiscount: "0.00" as unknown as never,
        total: "120.00" as unknown as never,
        customer: {
          name: "Ali Veli",
          taxNo: "1234567890",
          taxOffice: "Kadıköy",
          address: "İstanbul",
          phone: "05551234567",
          email: "ali@example.com",
        },
        company: { name: "Satıcı A.Ş.", taxNo: "9876543210", address: "İstanbul" },
        items: [
          {
            lineIndex: 0,
            productName: "Ürün A",
            quantity: "1" as unknown as never,
            unitPrice: "100.00" as unknown as never,
            discountAmount: "0.00" as unknown as never,
            lineNetAmount: "100.00" as unknown as never,
            vatRate: "20" as unknown as never,
            vatAmount: "20.00" as unknown as never,
            lineGrossAmount: "120.00" as unknown as never,
            unit: "Adet",
          },
        ],
      } as never,
      connectionMode: "DIRECT_ACCOUNT",
      providerCompanyId: "10",
      providerUserId: "20",
      prefix: "ABC",
      documentType: "E_ARCHIVE",
      internetSale: true,
    });

    assert.equal(payload.localReferenceId, "inv_123");
    assert.equal(payload.autoInvoiceId, true);
    assert.equal(payload.source, "WEB");
    assert.equal(payload.price, 12000);
    assert.equal(payload.taxAmount, 2000);
    assert.ok(payload.paymentInfo);
    assert.ok(payload.deliveryInfo);
  });

  it("partner modunda source PARTNER olur", () => {
    const payload = buildEfaturamDocumentPayload({
      invoice: {
        id: "inv_partner",
        invoiceNo: "FTR-002",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        saleId: null,
        taxableAmount: "50.00" as unknown as never,
        totalVat: "10.00" as unknown as never,
        totalDiscount: "0.00" as unknown as never,
        total: "60.00" as unknown as never,
        customer: {
          name: "Müşteri Ltd",
          taxNo: "1234567890",
          address: "Ankara",
        },
        company: { name: "Satıcı", taxNo: "9876543210", address: "İstanbul" },
        items: [
          {
            lineIndex: 0,
            productName: "Hizmet",
            quantity: "1" as unknown as never,
            unitPrice: "50.00" as unknown as never,
            discountAmount: "0.00" as unknown as never,
            lineNetAmount: "50.00" as unknown as never,
            vatRate: "20" as unknown as never,
            vatAmount: "10.00" as unknown as never,
            lineGrossAmount: "60.00" as unknown as never,
          },
        ],
      } as never,
      connectionMode: "MARKETPLACE_PARTNER",
      providerCompanyId: "10",
      providerUserId: "20",
      documentType: "E_INVOICE",
      targetAlias: "urn:mail:test@efatura.gov.tr",
    });

    assert.equal(payload.source, "PARTNER");
    assert.equal(payload.targetAlias, "urn:mail:test@efatura.gov.tr");
  });
});

describe("efaturam errors", () => {
  it("problem json mesajını Türkçeleştirir", () => {
    const message = translateEfaturamProblem({
      type: "/problem/unauthorized",
      detail: "Bearer token expired",
    });
    assert.match(message, /oturum/i);
  });
});
