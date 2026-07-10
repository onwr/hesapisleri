import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSupplierStatusView } from "./supplier-status-view";

describe("supplier-status-view", () => {
  it("aktif tedarikçi + sıfır bakiye çelişkili badge üretmez", () => {
    const view = buildSupplierStatusView({ isActive: true, signedBalance: 0 });
    assert.equal(view.operationalLabel, "Aktif");
    assert.equal(view.accountLabel, "Bakiye Yok");
    assert.notEqual(view.operationalLabel, view.accountLabel);
  });

  it("pasif tedarikçi operasyonel durumu ayrı gösterir", () => {
    const view = buildSupplierStatusView({ isActive: false, signedBalance: 150 });
    assert.equal(view.operationalLabel, "Pasif");
    assert.equal(view.accountLabel, "Tedarikçiye Borcumuz");
  });
});
