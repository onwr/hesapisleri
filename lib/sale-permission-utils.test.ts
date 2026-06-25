import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCancelSales, canUpdateSales } from "@/lib/sale-permission-utils";

describe("sale permission utils", () => {
  it("owner satış düzenleyebilir ve iptal edebilir", () => {
    assert.equal(canUpdateSales("STAFF", true), true);
    assert.equal(canCancelSales("STAFF", true), true);
  });

  it("muhasebeci satış düzenleyebilir ve iptal edebilir", () => {
    assert.equal(canUpdateSales("ACCOUNTANT"), true);
    assert.equal(canCancelSales("ACCOUNTANT"), true);
  });

  it("personel satış düzenleyemez ve iptal edemez", () => {
    assert.equal(canUpdateSales("STAFF"), false);
    assert.equal(canCancelSales("STAFF"), false);
  });
});
