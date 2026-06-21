import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMovementText } from "./stocks-page-utils";
import { generateTransferNo } from "./warehouse-transfer-utils";

describe("warehouse service utils", () => {
  it("generateTransferNo TRF formatı üretir", () => {
    const no = generateTransferNo();
    assert.match(no, /^TRF-\d{4}-\d+$/);
  });

  it('getMovementText("TRANSFER_IN") → Depo Girişi', () => {
    assert.equal(getMovementText("TRANSFER_IN"), "Depo Girişi");
    assert.equal(getMovementText("TRANSFER_OUT"), "Depo Çıkışı");
  });
});
