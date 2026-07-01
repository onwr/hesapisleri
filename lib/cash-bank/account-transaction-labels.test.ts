import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAccountTransactionTypeLabel } from "@/lib/cash-bank/account-transaction-labels";
import { getTenantCacheTag } from "@/lib/tenant-cache/tenant-cache-tags";

describe("account transaction type labels", () => {
  it("maps canonical transaction types to Turkish labels", () => {
    assert.equal(
      getAccountTransactionTypeLabel({ type: "INCOME", title: "Manuel gelir" }),
      "Para Girişi",
    );
    assert.equal(
      getAccountTransactionTypeLabel({ type: "EXPENSE", title: "Manuel gider" }),
      "Para Çıkışı",
    );
    assert.equal(
      getAccountTransactionTypeLabel({ type: "TRANSFER", title: "Transfer Girişi - Kasa" }),
      "Transfer Girişi",
    );
    assert.equal(
      getAccountTransactionTypeLabel({ type: "TRANSFER", title: "Transfer Çıkışı - Banka" }),
      "Transfer Çıkışı",
    );
    assert.equal(
      getAccountTransactionTypeLabel({ type: "COLLECTION", title: "Tahsilat" }),
      "Tahsilat",
    );
    assert.equal(
      getAccountTransactionTypeLabel({ type: "PAYMENT", title: "Ödeme" }),
      "Ödeme",
    );
  });
});

describe("account transaction detail cache tag", () => {
  it("uses cash-bank domain with company and transaction id", () => {
    const tag = getTenantCacheTag("company-1", "cash-bank", "tx-1");
    assert.match(tag, /company-1/);
    assert.match(tag, /tx-1/);
  });
});
