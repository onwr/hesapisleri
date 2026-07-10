import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BULK_PRICE_NEGATIVE_BATCH_ERROR,
  buildBulkPriceAdjustmentPlan,
  calculateAdjustedPrice,
} from "@/lib/product-bulk-service";

describe("product-bulk-service", () => {
  const product = {
    id: "p1",
    name: "Ürün A",
    sku: "SKU-A",
    buyPrice: 50,
    sellPrice: 100,
  };

  it("geçerli yüzde indirimi hesaplar", () => {
    const next = calculateAdjustedPrice(100, {
      priceField: "sell",
      direction: "decrease",
      mode: "percent",
      value: 10,
    });
    assert.equal(next, 90);
  });

  it("geçerli sabit indirim hesaplar", () => {
    const next = calculateAdjustedPrice(100, {
      priceField: "sell",
      direction: "decrease",
      mode: "fixed",
      value: 10,
    });
    assert.equal(next, 90);
  });

  it("negatif nihai fiyatı clamp etmez", () => {
    const next = calculateAdjustedPrice(5, {
      priceField: "sell",
      direction: "decrease",
      mode: "fixed",
      value: 10,
    });
    assert.equal(next, -5);
  });

  it("tam sıfır fiyatı kabul eder", () => {
    const next = calculateAdjustedPrice(10, {
      priceField: "sell",
      direction: "decrease",
      mode: "fixed",
      value: 10,
    });
    assert.equal(next, 0);

    const plan = buildBulkPriceAdjustmentPlan([product], {
      priceField: "sell",
      direction: "decrease",
      mode: "fixed",
      value: 100,
    });
    assert.equal(plan.violations.length, 0);
    assert.equal(plan.updates[0]?.sellPrice, 0);
  });

  it("negatif sonuç planında violation üretir", () => {
    const plan = buildBulkPriceAdjustmentPlan(
      [{ ...product, sellPrice: 5 }],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(plan.violations.length, 1);
    assert.equal(plan.violations[0]?.newPrice, -5);
    assert.equal(plan.negativeResultCount, 1);
  });

  it("karışık batchte tek violation tüm planı işaretler", () => {
    const plan = buildBulkPriceAdjustmentPlan(
      [
        product,
        { ...product, id: "p2", name: "Ürün B", sellPrice: 5 },
      ],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(plan.violations.length, 1);
    assert.equal(plan.validChangeCount, 1);
    assert.equal(plan.negativeResultCount, 1);
  });

  it("bulk negatif batch hata mesajı sabit", () => {
    assert.match(BULK_PRICE_NEGATIVE_BATCH_ERROR, /0'ın altına düşürüyor/);
  });
});
