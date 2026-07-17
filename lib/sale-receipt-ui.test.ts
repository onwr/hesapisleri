import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const viewSource = fs.readFileSync(
  path.join(process.cwd(), "components/sales/sale-receipt-view.tsx"),
  "utf8"
);
const actionsSource = fs.readFileSync(
  path.join(process.cwd(), "components/sales/sale-receipt-actions.tsx"),
  "utf8"
);
const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/sales/[id]/receipt/page.tsx"),
  "utf8"
);
const posSource = fs.readFileSync(
  path.join(process.cwd(), "app/pos/page.tsx"),
  "utf8"
);
const globals = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const printButton = fs.readFileSync(
  path.join(process.cwd(), "components/sales/print-sale-button.tsx"),
  "utf8"
);

describe("sale receipt ui", () => {
  it("80mm ve 58mm layout sınıflarını kullanır", () => {
    assert.match(viewSource, /receipt-width-80/);
    assert.match(viewSource, /receipt-width-58/);
    assert.match(globals, /max-width: 80mm/);
    assert.match(globals, /max-width: 58mm/);
    assert.match(globals, /\.no-print/);
  });

  it("Yazdır butonu window.print çağırır", () => {
    assert.match(actionsSource, /window\.print\(\)/);
    assert.match(actionsSource, /receipt-print-button/);
  });

  it("POS ve satış detay receipt route'a bağlanır", () => {
    assert.match(posSource, /\/sales\/\$\{successReceipt\.saleId\}\/receipt/);
    assert.match(printButton, /\/sales\/\$\{saleId\}\/receipt/);
    assert.match(pageSource, /getSaleReceiptData/);
  });

  it("print CSS sidebar/header gizler", () => {
    assert.match(globals, /aside,/);
    assert.match(globals, /header,/);
    assert.match(globals, /nav,/);
  });
});
