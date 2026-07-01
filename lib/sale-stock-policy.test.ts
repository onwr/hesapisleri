import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowsNegativeStock,
  buildInsufficientStockWarning,
  getStockWarning,
} from "./stock-policy";
import { buildSaleStockCorrectionDeltas } from "./sale-update-stock-utils";

describe("allowsNegativeStock", () => {
  it("varsayılan false döner — negatif stok varsayılan kapalı", () => {
    assert.equal(allowsNegativeStock(), false);
  });

  it("companySetting=true ile true döner", () => {
    assert.equal(allowsNegativeStock(true), true);
  });

  it("companySetting=false ile false döner", () => {
    assert.equal(allowsNegativeStock(false), false);
  });
});

describe("getStockWarning — manuel stok hareketi uyarıları", () => {
  it("yeterli stokta null döner", () => {
    assert.equal(getStockWarning(10, 5), null);
  });

  it("yetersiz stokta uyarı üretir", () => {
    const warning = getStockWarning(5, 10, "Kalem");
    assert.notEqual(warning, null);
    assert.match(warning!, /Kalem/);
  });
});

describe("buildSaleStockCorrectionDeltas", () => {
  it("aynı ürün ve depoda net delta hesaplar — miktar arttı", () => {
    const oldItems = [{ productId: "p1", warehouseId: "w1", quantity: 10 }];
    const newItems = [{ productId: "p1", warehouseId: "w1", quantity: 15 }];
    const deltas = buildSaleStockCorrectionDeltas(oldItems, newItems, "w1");
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]!.delta, 5);
    assert.equal(deltas[0]!.productId, "p1");
    assert.equal(deltas[0]!.warehouseId, "w1");
  });

  it("ürün çıkarıldığında negatif delta üretir (iade)", () => {
    const oldItems = [{ productId: "p1", warehouseId: "w1", quantity: 10 }];
    const newItems: typeof oldItems = [];
    const deltas = buildSaleStockCorrectionDeltas(oldItems, newItems, "w1");
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0]!.delta, -10);
  });

  it("aynı miktarda değişiklik yoksa delta listesi boş döner", () => {
    const items = [{ productId: "p1", warehouseId: "w1", quantity: 5 }];
    const deltas = buildSaleStockCorrectionDeltas(items, items, "w1");
    assert.equal(deltas.length, 0);
  });

  it("depo değişikliğinde eski depoya iade (negatif), yeni depoya çıkış (pozitif) delta", () => {
    const oldItems = [{ productId: "p1", warehouseId: "w1", quantity: 5 }];
    const newItems = [{ productId: "p1", warehouseId: "w2", quantity: 5 }];
    const deltas = buildSaleStockCorrectionDeltas(oldItems, newItems, "w2");
    assert.equal(deltas.length, 2);
    const w1Delta = deltas.find((d) => d.warehouseId === "w1");
    const w2Delta = deltas.find((d) => d.warehouseId === "w2");
    assert.equal(w1Delta!.delta, -5);
    assert.equal(w2Delta!.delta, 5);
  });

  it("null productId'li kalemleri atlar", () => {
    const oldItems = [{ productId: null as string | null, warehouseId: "w1", quantity: 5 }];
    const newItems: typeof oldItems = [];
    const deltas = buildSaleStockCorrectionDeltas(oldItems, newItems, "w1");
    assert.equal(deltas.length, 0);
  });
});

describe("buildInsufficientStockWarning", () => {
  it("eksik stok uyarısı doğru alanlarla oluşturur", () => {
    const warning = buildInsufficientStockWarning({
      productName: "Kalem",
      warehouseName: "Ana Depo",
      availableQty: 3,
      requestedQty: 10,
    });
    assert.equal(warning.availableQty, 3);
    assert.equal(warning.requestedQty, 10);
    assert.match(warning.message, /Kalem/);
    assert.match(warning.message, /Ana Depo/);
  });
});
