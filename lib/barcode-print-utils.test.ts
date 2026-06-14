import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BARCODE_LABEL_HEIGHT_MM,
  BARCODE_LABEL_WIDTH_MM,
  BARCODE_MISSING_MESSAGE,
  buildProductBarcodePrintHtml,
  buildProductBarcodesBulkPrintHtml,
  hasPrintableBarcode,
  printHtmlDocumentWithIframe,
} from "./barcode-print-utils";

describe("barcode print utils", () => {
  it("termal etiket boyut sabitleri tanımlı", () => {
    assert.equal(BARCODE_LABEL_WIDTH_MM, 50);
    assert.equal(BARCODE_LABEL_HEIGHT_MM, 30);
  });

  it("tek ürün barkod HTML üretir", () => {
    const html = buildProductBarcodePrintHtml({
      name: "Demo Webcam",
      barcode: "8690012345678",
      sku: "SKU-1",
      sellPriceLabel: "₺1.108,60",
    });

    assert.match(html, /Demo Webcam/);
    assert.match(html, /8690012345678/);
    assert.match(html, /SKU-1/);
    assert.match(html, /50mm/);
    assert.match(html, /30mm/);
  });

  it("barkodsuz ürün için hata fırlatır", () => {
    assert.throws(
      () =>
        buildProductBarcodePrintHtml({
          name: "Barkodsuz",
          barcode: null,
          sku: "SKU-2",
        }),
      (error: Error) => error.message === BARCODE_MISSING_MESSAGE
    );
  });

  it("toplu yazdırmada barkodsuz ürünleri atlar", () => {
    const html = buildProductBarcodesBulkPrintHtml([
      { name: "Demo", barcode: "869001", sku: "SKU-1" },
      { name: "Barkodsuz", barcode: null, sku: "SKU-2" },
    ]);

    assert.match(html, /869001/);
    assert.doesNotMatch(html, /SKU-2/);
  });

  it("hasPrintableBarcode barkod varlığını kontrol eder", () => {
    assert.equal(hasPrintableBarcode({ name: "A", barcode: "123" }), true);
    assert.equal(hasPrintableBarcode({ name: "A", barcode: "  " }), false);
    assert.equal(hasPrintableBarcode({ name: "A", barcode: null }), false);
  });

  it("iframe cleanup helper sunucuda false döner", () => {
    assert.equal(printHtmlDocumentWithIframe("<html></html>"), false);
  });
});
