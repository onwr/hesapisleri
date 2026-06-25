import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatFinanceAccountLabel,
  getFinanceAccountTypeLabel,
  groupFinanceAccounts,
  isFinanceOutflowAccountType,
  validateFinanceAccount,
} from "./finance-account-utils";

describe("finance-account-utils", () => {
  const activeCash = {
    id: "acc-1",
    companyId: "company-1",
    type: "CASH",
    status: "ACTIVE",
    currency: "TRY",
    name: "Merkez Kasa",
  };

  it("formats account label", () => {
    assert.equal(formatFinanceAccountLabel(activeCash), "Merkez Kasa — TRY");
  });

  it("groups cash and bank accounts", () => {
    const grouped = groupFinanceAccounts([
      { ...activeCash, balance: 100, isDefault: false },
      {
        id: "acc-2",
        companyId: "company-1",
        type: "BANK",
        status: "ACTIVE",
        currency: "TRY",
        name: "Ziraat Bankası",
        balance: 200,
        isDefault: false,
      },
    ]);

    assert.equal(grouped.cashAccounts.length, 1);
    assert.equal(grouped.bankAccounts.length, 1);
  });

  it("accepts active cash/bank accounts in same tenant", () => {
    const result = validateFinanceAccount(activeCash, "company-1", {
      paymentCurrency: "TRY",
      purpose: "disbursement",
    });

    assert.equal(result.ok, true);
  });

  it("rejects passive, foreign tenant and POS accounts", () => {
    assert.equal(
      validateFinanceAccount(
        { ...activeCash, status: "PASSIVE" },
        "company-1"
      ).ok,
      false
    );
    assert.equal(
      validateFinanceAccount(
        { ...activeCash, companyId: "other" },
        "company-1"
      ).ok,
      false
    );
    assert.equal(
      validateFinanceAccount(
        { ...activeCash, type: "POS" },
        "company-1"
      ).ok,
      false
    );
    assert.equal(isFinanceOutflowAccountType("POS"), false);
  });

  it("rejects currency mismatch", () => {
    const result = validateFinanceAccount(activeCash, "company-1", {
      paymentCurrency: "USD",
    });
    assert.equal(result.ok, false);
  });

  it("maps account type labels", () => {
    assert.equal(getFinanceAccountTypeLabel("CASH"), "Kasa");
    assert.equal(getFinanceAccountTypeLabel("BANK"), "Banka");
  });
});
