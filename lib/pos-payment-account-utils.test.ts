import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPosAccountsForMethod,
  isPosEligibleAccountForMethod,
  validatePosPaymentAccount,
} from "./pos-payment-account-utils";

const activeCash = {
  id: "cash-1",
  companyId: "company-1",
  name: "Merkez Kasa",
  type: "CASH",
  balance: 100,
  currency: "TRY",
  isDefault: true,
  status: "ACTIVE",
};

const activeBank = {
  id: "bank-1",
  companyId: "company-1",
  name: "Garanti POS",
  type: "BANK",
  balance: 500,
  currency: "TRY",
  isDefault: false,
  status: "ACTIVE",
  bankName: "Garanti",
};

const posTerminal = {
  id: "pos-1",
  companyId: "company-1",
  name: "Yazar Kasa POS",
  type: "POS",
  balance: 0,
  currency: "TRY",
  isDefault: false,
  status: "ACTIVE",
};

const legacyStaticCash = {
  id: "static-cash",
  name: "Eski Kasa",
  type: "STATIC",
  balance: 50,
  currency: "TRY",
  isDefault: false,
  status: "ACTIVE",
};

const legacyStaticBank = {
  id: "static-bank",
  name: "Eski Banka",
  type: "STATIC",
  balance: 200,
  currency: "TRY",
  isDefault: false,
  status: "ACTIVE",
  bankName: "Ziraat",
  iban: "TR000000000000000000000000",
};

describe("pos payment account utils", () => {
  it("filters cash accounts for nakit ödemeleri", () => {
    const accounts = filterPosAccountsForMethod(
      [activeCash, activeBank, legacyStaticCash, legacyStaticBank, posTerminal],
      "CASH"
    );

    assert.deepEqual(
      accounts.map((account) => account.id).sort(),
      ["cash-1", "static-cash"].sort()
    );
  });

  it("filters bank accounts for havale ödemeleri", () => {
    const accounts = filterPosAccountsForMethod(
      [activeCash, activeBank, legacyStaticBank, posTerminal],
      "BANK_TRANSFER"
    );

    assert.deepEqual(
      accounts.map((account) => account.id).sort(),
      ["bank-1", "static-bank"].sort()
    );
  });

  it("filters bank and POS accounts for kart ödemeleri", () => {
    const accounts = filterPosAccountsForMethod(
      [activeCash, activeBank, posTerminal, legacyStaticCash],
      "CARD"
    );

    assert.deepEqual(
      accounts.map((account) => account.id).sort(),
      ["bank-1", "pos-1"].sort()
    );
  });

  it("rejects foreign tenant, passive and incompatible account types", () => {
    assert.equal(
      validatePosPaymentAccount(
        { ...activeCash, companyId: "company-2" },
        "company-1",
        "CASH"
      ).ok,
      false
    );

    assert.equal(
      validatePosPaymentAccount(
        { ...activeCash, status: "PASSIVE" },
        "company-1",
        "CASH"
      ).ok,
      false
    );

    assert.equal(
      validatePosPaymentAccount(posTerminal, "company-1", "CASH").ok,
      false
    );

    assert.equal(
      validatePosPaymentAccount(activeCash, "company-1", "CARD").ok,
      false
    );
  });

  it("accepts compatible account for payment method", () => {
    assert.equal(
      isPosEligibleAccountForMethod(activeBank, "CARD"),
      true
    );
    assert.equal(
      validatePosPaymentAccount(posTerminal, "company-1", "CARD").ok,
      true
    );
  });
});
