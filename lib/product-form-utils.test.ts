import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductPayload,
  emptyProductFormValues,
  normalizeImageUrl,
  productFormSchema,
  productToFormValues,
  resolveInitialBarcodePayloadMode,
  shouldIncludeBarcodeInJsonPayload,
} from "./product-form-utils";

describe("product barcode payload", () => {
  it("create barcode olmadan barcode alanını payload'dan çıkarır", () => {
    const payload = buildProductPayload(emptyProductFormValues, {
      barcodeMode: "omit",
    });

    assert.equal("barcode" in payload, false);
    assert.equal(shouldIncludeBarcodeInJsonPayload("omit"), false);
  });

  it("create barcode verilirse kaydeder", () => {
    const payload = buildProductPayload(
      { ...emptyProductFormValues, name: "Demo", barcode: "8690012345678" },
      { barcodeMode: "include" }
    );

    assert.equal(payload.barcode, "8690012345678");
  });

  it("create toggle açık ama boş barkod null olur", () => {
    const payload = buildProductPayload(
      { ...emptyProductFormValues, name: "Demo", barcode: "" },
      { barcodeMode: "include" }
    );

    assert.equal(payload.barcode, null);
  });

  it("update clear modu barcode null döner", () => {
    const payload = buildProductPayload(
      { ...emptyProductFormValues, name: "Demo", barcode: "8690012345678" },
      { barcodeMode: "clear" }
    );

    assert.equal(payload.barcode, null);
    assert.equal(shouldIncludeBarcodeInJsonPayload("clear"), true);
  });

  it("edit barkodu olan ürün include modu ile başlar", () => {
    assert.equal(
      resolveInitialBarcodePayloadMode("edit", "8690012345678"),
      "include"
    );
    assert.equal(resolveInitialBarcodePayloadMode("edit", null), "omit");
    assert.equal(resolveInitialBarcodePayloadMode("create", null), "omit");
  });

  it("productFormSchema null barcode kabul eder", () => {
    const parsed = productFormSchema.safeParse({
      name: "Ürün Adı",
      barcode: null,
    });

    assert.equal(parsed.success, true);
  });
});

describe("product-form-utils decimal prices", () => {
  it("buildProductPayload virgüllü fiyatları parse eder", () => {
    const payload = buildProductPayload({
      ...emptyProductFormValues,
      name: "Demo Ürün",
      buyPrice: "780,50",
      sellPrice: "1.108,60",
    });

    assert.equal(payload.buyPrice, 780.5);
    assert.equal(payload.sellPrice, 1108.6);
  });
});

describe("product-form-utils imageUrl", () => {
  it("normalizeImageUrl boş değeri null yapar", () => {
    assert.equal(normalizeImageUrl(""), null);
    assert.equal(normalizeImageUrl("   "), null);
    assert.equal(normalizeImageUrl(null), null);
    assert.equal(
      normalizeImageUrl("https://cdn.example.com/product.jpg"),
      "https://cdn.example.com/product.jpg"
    );
  });

  it("buildProductPayload imageUrl içerir", () => {
    const payload = buildProductPayload({
      ...emptyProductFormValues,
      name: "Demo Ürün",
      imageUrl: "https://cdn.example.com/a.png",
    });

    assert.equal(payload.imageUrl, "https://cdn.example.com/a.png");
  });

  it("buildProductPayload boş imageUrl null döner (görsel kaldırma)", () => {
    const payload = buildProductPayload({
      ...emptyProductFormValues,
      name: "Demo Ürün",
      imageUrl: "",
    });

    assert.equal(payload.imageUrl, null);
  });

  it("productFormSchema null imageUrl kabul eder", () => {
    const parsed = productFormSchema.safeParse({
      name: "Ürün Adı",
      imageUrl: null,
    });

    assert.equal(parsed.success, true);
  });

  it("productToFormValues imageUrl doldurur", () => {
    const values = productToFormValues({
      name: "Ürün",
      sku: null,
      barcode: null,
      description: null,
      imageUrl: "https://cdn.example.com/b.webp",
      status: "ACTIVE",
      stock: 5,
      minStock: 10,
      unitType: "PIECE",
      warehouseLocation: null,
      buyPrice: 10,
      sellPrice: 20,
      vatRate: 20,
      category: { name: "Genel" },
    });

    assert.equal(values.imageUrl, "https://cdn.example.com/b.webp");
  });

  it("productFormSchema imageUrl opsiyonel kabul eder", () => {
    const withoutImage = productFormSchema.safeParse({
      name: "Ürün Adı",
      imageUrl: undefined,
    });
    assert.equal(withoutImage.success, true);

    const withImage = productFormSchema.safeParse({
      name: "Ürün Adı",
      imageUrl: "https://cdn.example.com/c.jpg",
    });
    assert.equal(withImage.success, true);
  });
});
