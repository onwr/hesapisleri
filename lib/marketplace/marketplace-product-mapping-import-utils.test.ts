import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductLookupMaps,
  classifyMappingAfterUniqueViolation,
  decideListingImport,
  isPrismaUniqueConstraintError,
  isProductMappingImportEmptyResult,
  resolveListingProductMatch,
  sanitizeMarketplaceErrorMessage,
  skipReasonLabel,
} from "@/lib/marketplace/marketplace-product-mapping-import-utils";

const products = [
  { id: "p1", name: "Ürün 1", sku: "SKU-1", barcode: "8690000000001" },
  { id: "p2", name: "Ürün 2", sku: "SKU-2", barcode: "8690000000002" },
];

describe("marketplace product mapping import utils", () => {
  it("merchantSku ile mevcut Product.sku eşleşirse mapped kararı verir", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "SKU-1",
        barcode: null,
        title: "Trendyol ürün",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "mapped");
    if (decision.action === "mapped") {
      assert.equal(decision.productId, "p1");
    }
  });

  it("barcode ile mevcut Product.barcode eşleşirse mapped kararı verir", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "TY-REMOTE-1",
        barcode: "8690000000002",
        title: "Trendyol ürün",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "mapped");
    if (decision.action === "mapped") {
      assert.equal(decision.productId, "p2");
    }
  });

  it("eşleşmeyen listing unmatched olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "UNKNOWN-SKU",
        barcode: "0000000000000",
        title: "Yok",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "unmatched");
  });

  it("aynı mapping varsa alreadyMapped olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "SKU-1",
        barcode: "8690000000001",
        title: "Trendyol ürün",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map([
        ["SKU-1", { productId: "p1", barcode: "8690000000001" }],
      ]),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "already_mapped");
  });

  it("duplicate/çakışma varsa conflict olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "SKU-1",
        barcode: "8690000000002",
        title: "Çakışma",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "conflict");
  });

  it("merchant SKU farklı ürüne eşliyse conflict olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "SKU-1",
        barcode: null,
        title: "Trendyol ürün",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map([
        ["SKU-1", { productId: "p2", barcode: null }],
      ]),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "conflict");
  });

  it("duplicate listing skipped olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const seen = new Set<string>(["SKU-1"]);
    const decision = decideListingImport({
      listing: {
        merchantSku: "SKU-1",
        barcode: null,
        title: "Tekrar",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: seen,
    });

    assert.equal(decision.action, "skip");
    assert.equal(decision.reason, "duplicate_listing");
  });

  it("merchantSku yoksa skipped olur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const decision = decideListingImport({
      listing: {
        merchantSku: "   ",
        barcode: "8690000000001",
        title: "Boş SKU",
      },
      bySku,
      byBarcode,
      existingMappingsByMerchantSku: new Map(),
      seenMerchantSkus: new Set(),
    });

    assert.equal(decision.action, "skip");
    assert.equal(decision.reason, "missing_merchant_sku");
  });

  it("resolveListingProductMatch sku önceliğini korur", () => {
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const match = resolveListingProductMatch({
      listing: { merchantSku: "SKU-1", barcode: "8690000000001" },
      bySku,
      byBarcode,
    });
    assert.equal(match.product?.id, "p1");
    assert.equal(match.conflictReason, undefined);
  });

  it("yeni Product oluşturma aksiyonu yoktur", () => {
    const actions = new Set([
      "skip",
      "unmatched",
      "conflict",
      "already_mapped",
      "mapped",
    ]);
    const { bySku, byBarcode } = buildProductLookupMaps(products);
    const samples = [
      { merchantSku: "SKU-1", barcode: null },
      { merchantSku: "UNKNOWN", barcode: null },
      { merchantSku: "SKU-1", barcode: "8690000000002" },
    ] as const;

    for (const listing of samples) {
      const decision = decideListingImport({
        listing: { ...listing, title: "x" },
        bySku,
        byBarcode,
        existingMappingsByMerchantSku: new Map(),
        seenMerchantSkus: new Set(),
      });
      assert.equal(actions.has(decision.action), true);
      assert.notEqual(decision.action, "create_product");
    }
  });

  it("secret response mesajından temizlenir", () => {
    const sanitized = sanitizeMarketplaceErrorMessage(
      "Auth failed apiKey=super-secret-key apiSecret=top-secret"
    );
    assert.equal(sanitized.includes("super-secret-key"), false);
    assert.equal(sanitized.includes("top-secret"), false);
    assert.equal(sanitized.includes("[REDACTED]"), true);
  });

  it("unique violation sonrası aynı productId already_mapped olur", () => {
    assert.equal(
      classifyMappingAfterUniqueViolation({
        expectedProductId: "p1",
        existingProductId: "p1",
      }),
      "already_mapped"
    );
  });

  it("unique violation sonrası farklı productId conflict olur", () => {
    assert.equal(
      classifyMappingAfterUniqueViolation({
        expectedProductId: "p1",
        existingProductId: "p2",
      }),
      "conflict"
    );
  });

  it("Prisma P2002 unique constraint algılanır", () => {
    assert.equal(isPrismaUniqueConstraintError({ code: "P2002" }), true);
    assert.equal(isPrismaUniqueConstraintError(new Error("fail")), false);
  });

  it("tüm metrikler sıfırsa empty import sonucu true döner", () => {
    assert.equal(
      isProductMappingImportEmptyResult({
        fetched: 0,
        mapped: 0,
        alreadyMapped: 0,
        unmatched: 0,
        skipped: 0,
        conflicts: 0,
      }),
      true
    );
    assert.equal(
      isProductMappingImportEmptyResult({
        fetched: 0,
        mapped: 0,
        alreadyMapped: 0,
        unmatched: 0,
        skipped: 1,
        conflicts: 0,
      }),
      false
    );
  });

  it("skipReasonLabel merchantSku yok mesajı üretir", () => {
    assert.equal(skipReasonLabel("missing_merchant_sku"), "Merchant SKU yok.");
    assert.equal(
      skipReasonLabel("duplicate_listing", "Aynı merchant SKU tekrarlandı."),
      "Aynı merchant SKU tekrarlandı."
    );
  });
});
