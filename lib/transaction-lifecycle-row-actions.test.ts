import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LINKED_TRANSACTION_CANCEL_MESSAGE,
  resolveLinkedTransactionSource,
} from "./transaction-lifecycle-enforcement";
import { getExpenseRowActions } from "./transaction-lifecycle-row-actions";

describe("transaction lifecycle row actions", () => {
  it("PAID expense allows cancel/reverse but not delete", () => {
    const actions = getExpenseRowActions({
      status: "APPROVED",
      paymentStatus: "PAID",
    });
    assert.equal(actions.delete, false);
    assert.equal(actions.cancel, true);
    assert.equal(actions.reverse, true);
  });

  it("PENDING expense allows edit/delete/cancel", () => {
    const actions = getExpenseRowActions({
      status: "PENDING",
      paymentStatus: "UNPAID",
    });
    assert.equal(actions.edit, true);
    assert.equal(actions.delete, true);
    assert.equal(actions.cancel, true);
  });

  it("linked expense transaction is detected", () => {
    const linked = resolveLinkedTransactionSource({
      expenseId: "exp-1",
      title: "Manuel",
    });
    assert.equal(linked.linked, true);
    if (linked.linked) {
      assert.equal(linked.source, "expense");
    }
  });

  it("exposes Turkish linked cancel message", () => {
    assert.match(LINKED_TRANSACTION_CANCEL_MESSAGE, /bağlı olduğu işlem/i);
  });
});
