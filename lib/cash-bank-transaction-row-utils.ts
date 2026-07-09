import {
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";
import { inferTransactionSource } from "@/lib/cash-bank-account-utils";
import { LINKED_TRANSACTION_CANCEL_MESSAGE } from "@/lib/transaction-lifecycle-enforcement";
import { getAccountTransactionRowActions } from "@/lib/transaction-lifecycle-row-actions";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";

export type CashBankTransactionMutationContext = {
  id: string;
  title: string;
  note?: string | null;
  type: string;
  expenseId?: string | null;
  invoiceId?: string | null;
  supplierId?: string | null;
  transferGroupId?: string | null;
  isLinkedEmployeePayment?: boolean;
};

export function resolveCashBankTransactionMutationContext(
  transaction: CashBankTransactionMutationContext
) {
  const source = inferTransactionSource(transaction);
  const isMirror = isFinanceMirrorTransaction(transaction);
  const isLinked =
    Boolean(transaction.expenseId) ||
    Boolean(transaction.invoiceId) ||
    Boolean(transaction.supplierId) ||
    Boolean(transaction.transferGroupId) ||
    Boolean(transaction.isLinkedEmployeePayment) ||
    source.key !== "manual";

  const lifecycleActions: LifecycleActionMatrix = isLinked
    ? { view: true, edit: false, delete: false, cancel: false, reverse: false, archive: false, restore: false }
    : isMirror
      ? { view: true, edit: false, delete: false, cancel: false, reverse: false, archive: false, restore: false }
      : getAccountTransactionRowActions({
          title: transaction.title,
          note: transaction.note,
          isLinked: false,
        });

  let linkedHref: string | undefined;
  if (transaction.expenseId) linkedHref = `/expenses/${transaction.expenseId}`;
  else if (transaction.invoiceId) linkedHref = `/invoices/${transaction.invoiceId}`;
  else if (transaction.supplierId) linkedHref = `/suppliers/${transaction.supplierId}`;

  return {
    sourceKey: source.key,
    sourceLabel: source.label,
    isLinked,
    isMirror,
    isTransfer: transaction.type === "TRANSFER" && Boolean(transaction.transferGroupId),
    transferGroupId: transaction.transferGroupId,
    lifecycleActions,
    linkedHref,
    linkedMessage: LINKED_TRANSACTION_CANCEL_MESSAGE,
  };
}
