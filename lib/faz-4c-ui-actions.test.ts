import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInvoiceDetailActions } from "./invoice-lifecycle-utils";
import { resolveCashBankTransactionMutationContext } from "./cash-bank-transaction-row-utils";
import { resolveOrderLifecycleActions } from "./order-lifecycle-utils";
import { LINKED_TRANSACTION_CANCEL_MESSAGE } from "./transaction-lifecycle-enforcement";

describe("invoice lifecycle utils", () => {
  it("DRAFT normal fatura silinebilir", () => {
    const actions = resolveInvoiceDetailActions({
      status: "DRAFT",
      paymentStatus: "UNPAID",
      type: "NORMAL",
      paidAmount: 0,
      total: 100,
    });
    assert.equal(actions.canDelete, true);
    assert.equal(actions.canEdit, true);
  });

  it("tahsilatlı fatura iptal edilemez", () => {
    const actions = resolveInvoiceDetailActions({
      status: "SENT",
      paymentStatus: "PARTIAL",
      type: "NORMAL",
      paidAmount: 50,
      total: 100,
    });
    assert.equal(actions.canCancel, false);
  });

  it("gönderilmiş e-fatura provider iptali gerektirir", () => {
    const actions = resolveInvoiceDetailActions({
      status: "SENT",
      paymentStatus: "UNPAID",
      type: "E_INVOICE",
      paidAmount: 0,
      total: 100,
      documentSubmission: { status: "SUCCESS", documentType: "E_INVOICE" },
    });
    assert.equal(actions.requiresProviderCancel, true);
    assert.equal(actions.canCancel, false);
  });
});

describe("cash bank transaction row utils", () => {
  it("bağlı gider hareketi silinemez", () => {
    const ctx = resolveCashBankTransactionMutationContext({
      id: "tx-1",
      title: "Gider - Test",
      type: "EXPENSE",
      expenseId: "exp-1",
    });
    assert.equal(ctx.isLinked, true);
    assert.equal(ctx.lifecycleActions.delete, false);
    assert.match(ctx.linkedMessage, /bağlı olduğu işlem/i);
  });

  it("manuel hareket ters kayıt veya silme için uygun", () => {
    const ctx = resolveCashBankTransactionMutationContext({
      id: "tx-2",
      title: "Manuel Giriş",
      type: "INCOME",
    });
    assert.equal(ctx.isLinked, false);
    assert.equal(ctx.lifecycleActions.reverse, true);
  });

  it("transfer hareketi transferGroupId ile işaretlenir", () => {
    const ctx = resolveCashBankTransactionMutationContext({
      id: "tx-3",
      title: "Transfer Çıkışı",
      type: "TRANSFER",
      transferGroupId: "grp-1",
    });
    assert.equal(ctx.isTransfer, true);
  });
});

describe("order lifecycle utils", () => {
  it("marketplace sipariş hard delete edilemez", () => {
    const actions = resolveOrderLifecycleActions({
      sourceChannel: "TRENDYOL",
      status: "WAITING",
    });
    assert.equal(actions.isMarketplace, true);
    assert.equal(actions.canHardDelete, false);
    assert.equal(actions.lifecycleActions.archive, true);
  });

  it("manuel sipariş bekleyen durumda düzenlenebilir", () => {
    const actions = resolveOrderLifecycleActions({
      sourceChannel: "MANUAL",
      status: "WAITING",
    });
    assert.equal(actions.lifecycleActions.edit, true);
    assert.equal(actions.lifecycleActions.delete, true);
  });
});

describe("linked movement message", () => {
  it("Türkçe bağlı işlem mesajı expose edilir", () => {
    assert.match(LINKED_TRANSACTION_CANCEL_MESSAGE, /bağlı olduğu işlem/i);
  });
});
