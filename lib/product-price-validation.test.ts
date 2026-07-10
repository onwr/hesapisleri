import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalProductPriceSchema,
  parseProductPriceInput,
  PRODUCT_PRICE_NEGATIVE_ERROR,
  validateProductPriceValue,
} from "./product-price-validation";

describe("product-price-validation", () => {
  it("negatif değerleri reddeder", () => {
    assert.equal(validateProductPriceValue(-1).ok, false);
    assert.equal(validateProductPriceValue(-0.01).ok, false);
    assert.equal(parseProductPriceInput("-1.000,50").ok, false);
    const negative = parseProductPriceInput("-1.000,50");
    assert.equal(negative.ok, false);
    if (!negative.ok) {
      assert.equal(negative.message, PRODUCT_PRICE_NEGATIVE_ERROR);
    }
  });

  it("sıfır ve pozitif değerleri kabul eder", () => {
    assert.equal(validateProductPriceValue(0).ok, true);
    assert.equal(validateProductPriceValue(100.5).ok, true);
    const parsedPositive = parseProductPriceInput("100,50");
    assert.equal(parsedPositive.ok, true);
    if (parsedPositive.ok) {
      assert.equal(parsedPositive.value, 100.5);
    }
  });

  it("NaN ve Infinity reddedilir", () => {
    assert.equal(validateProductPriceValue(Number.NaN).ok, false);
    assert.equal(validateProductPriceValue(Number.POSITIVE_INFINITY).ok, false);
  });

  it("canonical zod schema negatif payload reddeder", () => {
    const parsed = canonicalProductPriceSchema.safeParse(-5);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.issues[0]?.message, PRODUCT_PRICE_NEGATIVE_ERROR);
    }
  });
});
