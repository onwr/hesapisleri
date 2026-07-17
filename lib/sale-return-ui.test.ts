import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const formSource = fs.readFileSync(
  path.join(process.cwd(), "components/sales/sale-return-form.tsx"),
  "utf8"
);
const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/sales/[id]/return/page.tsx"),
  "utf8"
);
const detailSource = fs.readFileSync(
  path.join(process.cwd(), "app/sales/[id]/page.tsx"),
  "utf8"
);
const receiptActions = fs.readFileSync(
  path.join(process.cwd(), "components/sales/sale-return-receipt-actions.tsx"),
  "utf8"
);

describe("sale return ui", () => {
  it("iade formu adet, yöntem ve submit içerir", () => {
    assert.match(formSource, /İade adedi/);
    assert.match(formSource, /refundMethod/);
    assert.match(formSource, /sale-return-submit/);
    assert.match(formSource, /Toplam iade/);
    assert.match(formSource, /Stoğa geri al/);
    assert.match(formSource, /Değişim için iade/);
  });

  it("iade route ve satış detay butonu bağlanır", () => {
    assert.match(pageSource, /SaleReturnForm/);
    assert.match(detailSource, /\/sales\/\$\{sale\.id\}\/return/);
    assert.match(detailSource, /İade \/ Değişim/);
    assert.match(detailSource, /İade geçmişi/);
    assert.match(detailSource, /Kısmi İade/);
  });

  it("iade fişi window.print çağırır", () => {
    assert.match(receiptActions, /window\.print\(\)/);
    assert.match(receiptActions, /return-receipt-print-button/);
  });
});
