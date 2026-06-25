import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCollectionAccountLabel,
  groupCollectionAccounts,
  isCollectionEligibleAccount,
  resolveDefaultCollectionAccountId,
  validateCollectionAccount,
} from "@/lib/collection-account-utils";

const accounts = [
  {
    id: "cash1",
    name: "Merkez Kasa",
    type: "CASH",
    balance: 100,
    currency: "TRY",
    isDefault: true,
  },
  {
    id: "bank1",
    name: "Garanti Bankası",
    type: "BANK",
    balance: 500,
    currency: "TRY",
    isDefault: false,
  },
];

describe("collection account utils", () => {
  it("gruplar kasa ve banka hesaplarını", () => {
    const grouped = groupCollectionAccounts(accounts);
    assert.equal(grouped.cashAccounts.length, 1);
    assert.equal(grouped.bankAccounts.length, 1);
    assert.equal(grouped.cashAccounts[0]?.name, "Merkez Kasa");
  });

  it("hesap etiketinde para birimi gösterir", () => {
    assert.equal(
      formatCollectionAccountLabel({ name: "Merkez Kasa", currency: "TRY" }),
      "Merkez Kasa — TRY"
    );
  });

  it("varsayılan hesabı seçer", () => {
    assert.equal(resolveDefaultCollectionAccountId(accounts), "cash1");
    assert.equal(resolveDefaultCollectionAccountId(accounts, "bank1"), "bank1");
  });

  it("tahsilat uygunluğunu kontrol eder", () => {
    assert.equal(isCollectionEligibleAccount({ type: "CASH", status: "ACTIVE" }), true);
    assert.equal(isCollectionEligibleAccount({ type: "STATIC", status: "ACTIVE" }), true);
    assert.equal(isCollectionEligibleAccount({ type: "POS", status: "ACTIVE" }), false);
    assert.equal(isCollectionEligibleAccount({ type: "BANK", status: "PASSIVE" }), false);
  });

  it("company ve tip doğrulaması yapar", () => {
    const valid = validateCollectionAccount(
      {
        id: "cash1",
        companyId: "c1",
        type: "CASH",
        status: "ACTIVE",
        name: "Merkez Kasa",
      },
      "c1"
    );
    assert.equal(valid.ok, true);

    const wrongCompany = validateCollectionAccount(
      {
        id: "cash1",
        companyId: "c2",
        type: "CASH",
        status: "ACTIVE",
        name: "Merkez Kasa",
      },
      "c1"
    );
    assert.equal(wrongCompany.ok, false);

    const wrongType = validateCollectionAccount(
      {
        id: "pos1",
        companyId: "c1",
        type: "POS",
        status: "ACTIVE",
        name: "POS",
      },
      "c1"
    );
    assert.equal(wrongType.ok, false);
  });
});
