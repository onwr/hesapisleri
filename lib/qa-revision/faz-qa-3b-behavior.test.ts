/**
 * QA Faz 3B — tedarikçi cari hesap davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  adjustmentBalanceEffect,
  collectionBalanceEffect,
  paymentBalanceEffect,
  resolveSupplierBalanceDirection,
  resolveSupplierBalanceView,
  signedBalanceFromOpeningInput,
  summarizeSupplierBalances,
} from "@/lib/supplier-balance-utils";
import {
  expenseLedgerDebitCredit,
  expensePaymentLedgerDebitCredit,
} from "@/lib/supplier-ledger-utils";
import { parseSupplierFinanceAmount } from "@/lib/supplier-payment-validation";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 3B balance direction", () => {
  it("PAYABLE positive signed balance", () => {
    const view = resolveSupplierBalanceView(1500);
    assert.equal(view.direction, "PAYABLE");
    assert.equal(view.payableAmount, 1500);
    assert.equal(view.receivableAmount, 0);
    assert.equal(view.directionLabel, "Tedarikçiye Borcumuz");
  });

  it("RECEIVABLE negative signed balance", () => {
    const view = resolveSupplierBalanceView(-250);
    assert.equal(view.direction, "RECEIVABLE");
    assert.equal(view.payableAmount, 0);
    assert.equal(view.receivableAmount, 250);
    assert.equal(view.directionLabel, "Tedarikçiden Alacağımız");
  });

  it("SETTLED zero balance", () => {
    assert.equal(resolveSupplierBalanceDirection(0), "SETTLED");
    const view = resolveSupplierBalanceView(0);
    assert.equal(view.netStatusLabel, "Bakiye Yok");
  });
});

describe("Faz 3B opening balance", () => {
  it("rejects negative amount", () => {
    const result = signedBalanceFromOpeningInput({ amount: -10, direction: "PAYABLE" });
    assert.equal(result.ok, false);
  });

  it("PAYABLE direction positive signed", () => {
    const result = signedBalanceFromOpeningInput({ amount: 100, direction: "PAYABLE" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.signed, 100);
  });

  it("RECEIVABLE direction negative signed", () => {
    const result = signedBalanceFromOpeningInput({ amount: 100, direction: "RECEIVABLE" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.signed, -100);
  });

  it("SETTLED zero amount", () => {
    const result = signedBalanceFromOpeningInput({ amount: 0, direction: "SETTLED" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.signed, 0);
  });
});

describe("Faz 3B ledger effects", () => {
  it("unpaid expense creates payable debit only", () => {
    const row = expenseLedgerDebitCredit({
      amount: 500,
      paymentStatus: "UNPAID",
      status: "APPROVED",
    });
    assert.equal(row.debit, 500);
    assert.equal(row.credit, 0);
  });

  it("paid expense accrual suppressed", () => {
    const row = expenseLedgerDebitCredit({
      amount: 500,
      paymentStatus: "PAID",
      status: "APPROVED",
    });
    assert.equal(row.debit, 0);
    assert.equal(row.credit, 0);
  });

  it("expense payment credit only", () => {
    const row = expensePaymentLedgerDebitCredit(500);
    assert.equal(row.credit, 500);
  });

  it("payment reduces payable", () => {
    assert.equal(paymentBalanceEffect(200), -200);
  });

  it("collection reduces receivable", () => {
    assert.equal(collectionBalanceEffect(200), 200);
  });

  it("adjustment directions", () => {
    assert.equal(adjustmentBalanceEffect(100, "PAYABLE"), 100);
    assert.equal(adjustmentBalanceEffect(100, "RECEIVABLE"), -100);
  });
});

describe("Faz 3B validation", () => {
  it("rejects non-positive amount", () => {
    assert.equal(parseSupplierFinanceAmount(0).ok, false);
    assert.equal(parseSupplierFinanceAmount(-5).ok, false);
    assert.equal(parseSupplierFinanceAmount("x").ok, false);
  });
});

describe("Faz 3B list summary does not net payable/receivable", () => {
  it("summarize keeps separate totals", () => {
    const totals = summarizeSupplierBalances([1000, -300, 0, -200]);
    assert.equal(totals.totalPayable, 1000);
    assert.equal(totals.totalReceivable, 500);
  });
});

describe("Faz 3B UI contract", () => {
  it("supplier detail labels present", () => {
    const src = readSrc("components/suppliers/supplier-detail-client.tsx");
    assert.match(src, /Tedarikçiye Ödeme Yap/);
    assert.match(src, /Tedarikçiden Tahsilat Al/);
    assert.match(src, /SUPPLIER_BALANCE_LABELS\.PAYABLE/);
    assert.match(src, /SUPPLIER_BALANCE_LABELS\.RECEIVABLE/);
    assert.match(src, /Müşteri Rolü Ekle/);
    assert.match(src, /Cari Hareketler/);
    assert.doesNotMatch(src, /cash-bank\?tab=transactions/);
  });

  it("supplier ledger table hides raw signed labels", () => {
    const src = readSrc("components/suppliers/supplier-ledger-table.tsx");
    assert.match(src, /Bakiye Yönü/);
    assert.match(src, /SUPPLIER_BALANCE_LABELS/);
  });
});
