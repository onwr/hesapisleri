import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildSaleCartStockLimitMessage,
  MAX_SALE_CART_QUANTITY,
  normalizeCommittedSaleCartQuantity,
  parseSaleCartQuantityInput,
  resolveSaleCartQuantityCommit,
  validateSaleCartQuantityAgainstStock,
} from "./sale-cart-quantity-utils";

describe("sale cart quantity utils", () => {
  const stockItem = {
    productId: "p1",
    name: "Kalem",
    quantity: 2,
    stock: 8,
    productType: "STOCK" as const,
  };

  const serviceItem = {
    productId: "s1",
    name: "Danışmanlık",
    quantity: 1,
    stock: 0,
    productType: "SERVICE" as const,
  };

  it("geçerli tam sayı miktarı parse eder", () => {
    assert.deepEqual(parseSaleCartQuantityInput("12"), {
      kind: "valid",
      value: 12,
    });
  });

  it("boş girişi geçici olarak kabul eder", () => {
    assert.deepEqual(parseSaleCartQuantityInput(""), { kind: "empty" });
    assert.deepEqual(parseSaleCartQuantityInput("   "), { kind: "empty" });
  });

  it("ondalık, metin ve negatif değerleri reddeder", () => {
    assert.deepEqual(parseSaleCartQuantityInput("1.5"), { kind: "invalid" });
    assert.deepEqual(parseSaleCartQuantityInput("abc"), { kind: "invalid" });
    assert.deepEqual(parseSaleCartQuantityInput("-2"), { kind: "invalid" });
  });

  it("sıfır değeri commit sırasında ürünü kaldırır", () => {
    const result = resolveSaleCartQuantityCommit({
      raw: "0",
      currentQuantity: 3,
      item: stockItem,
    });

    assert.equal(result.remove, true);
    assert.equal(result.error, null);
  });

  it("stok üstü miktarı negatif stok kapalıyken reddeder", () => {
    const error = validateSaleCartQuantityAgainstStock(stockItem, 9, {
      allowNegativeStock: false,
    });

    assert.equal(
      error,
      buildSaleCartStockLimitMessage("Kalem", 8)
    );
  });

  it("negatif stok açıkken stok üstü miktarı engellemez", () => {
    const error = validateSaleCartQuantityAgainstStock(stockItem, 50, {
      allowNegativeStock: true,
    });

    assert.equal(error, null);
  });

  it("hizmet ürününde stok sınırı uygulanmaz", () => {
    const error = validateSaleCartQuantityAgainstStock(serviceItem, 100, {
      allowNegativeStock: false,
    });

    assert.equal(error, null);
  });

  it("geçersiz commit önceki miktarı korur", () => {
    const result = resolveSaleCartQuantityCommit({
      raw: "abc",
      currentQuantity: 4,
      item: stockItem,
      allowNegativeStock: false,
    });

    assert.equal(result.quantity, 4);
    assert.equal(result.remove, false);
    assert.equal(result.error, "Geçerli bir adet girin.");
  });

  it("üst sınırı aşan miktarı reddeder", () => {
    const over = String(MAX_SALE_CART_QUANTITY + 1);
    assert.deepEqual(parseSaleCartQuantityInput(over), { kind: "invalid" });
    assert.equal(normalizeCommittedSaleCartQuantity(MAX_SALE_CART_QUANTITY + 1), null);
  });
});

describe("sale cart quantity input component", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const src = readFileSync(
    join(root, "components/sales/sale-cart-quantity-input.tsx"),
    "utf8"
  );

  it("inputMode, aria-label ve Enter/blur commit desteği içerir", () => {
    assert.match(src, /inputMode="numeric"/);
    assert.match(src, /aria-label=\{`\$\{productName\} miktarı`\}/);
    assert.match(src, /event\.key === "Enter"/);
    assert.match(src, /onBlur=\{/);
    assert.match(src, /onWheel=/);
    assert.match(src, /event\.currentTarget\.select\(\)/);
  });
});
