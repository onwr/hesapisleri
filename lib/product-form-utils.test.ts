import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductPayload,
  emptyProductFormValues,
  normalizeImageUrl,
  productFormSchema,
  productToFormValues,
} from "./product-form-utils";

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
