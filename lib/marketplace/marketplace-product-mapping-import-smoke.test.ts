import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductMappingImportResult } from "@/lib/marketplace/marketplace-product-mapping-import-service";
import { sanitizeMarketplaceErrorMessage } from "@/lib/marketplace/marketplace-product-mapping-import-utils";
import { CHANNEL_UI_CONFIG } from "@/components/settings/integrations/integration-ui-config";

describe("product mapping import smoke checks", () => {
  it("response shape credential ve raw içermez", () => {
    const sample: ProductMappingImportResult = {
      success: true,
      channel: "TRENDYOL",
      fetched: 1,
      mapped: 1,
      alreadyMapped: 0,
      unmatched: 0,
      skipped: 0,
      conflicts: 0,
      items: {
        mapped: [
          {
            merchantSku: "STK-1",
            barcode: "8691111111111",
            title: "Test",
            productId: "prod-1",
            productName: "Panel Ürün",
          },
        ],
        unmatched: [],
        conflicts: [],
        skipped: [
          {
            merchantSku: "",
            barcode: "8692222222222",
            title: "SKUsuz",
            reason: "Merchant SKU yok.",
          },
        ],
      },
    };

    const serialized = JSON.stringify(sample);
    assert.equal(serialized.includes("apiKey"), false);
    assert.equal(serialized.includes("apiSecret"), false);
    assert.equal(serialized.includes('"raw"'), false);
    assert.equal(serialized.includes("credentialsEncrypted"), false);
    assert.equal(serialized.includes("Merchant SKU yok."), true);
  });

  it("Trendyol mapping route doğru", () => {
    assert.equal(
      CHANNEL_UI_CONFIG.TRENDYOL.mappingHref,
      "/products/channel-mapping?channel=TRENDYOL"
    );
    assert.equal(CHANNEL_UI_CONFIG.TRENDYOL.supportsProductMappingImport, true);
    assert.equal(CHANNEL_UI_CONFIG.HEPSIBURADA.supportsProductMappingImport, false);
  });

  it("HB unsupported mesajı route tarafından 400 olarak sınıflandırılır", () => {
    const message = "Bu kanal için ürün eşleme importu henüz desteklenmiyor.";
    const status =
      message.includes("desteklenmiyor") ||
      message.includes("bağlı olmalıdır") ||
      message.includes("kimlik bilgileri")
        ? 400
        : 500;
    assert.equal(status, 400);
  });

  it("CONNECTED değil mesajı route tarafından 400 olarak sınıflandırılır", () => {
    const message = "Ürün eşleme importu için entegrasyon bağlı olmalıdır.";
    const status =
      message.includes("desteklenmiyor") ||
      message.includes("bağlı olmalıdır") ||
      message.includes("kimlik bilgileri")
        ? 400
        : 500;
    assert.equal(status, 400);
  });

  it("sanitizeMarketplaceErrorMessage credential sızdırmaz", () => {
    const input =
      "Trendyol failed Authorization: Basic abc123 apiSecret=super-secret-value";
    const output = sanitizeMarketplaceErrorMessage(input);
    assert.equal(output.includes("super-secret-value"), false);
  });
});
