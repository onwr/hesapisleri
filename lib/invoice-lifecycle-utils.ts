import { getInvoiceRowActions } from "@/lib/transaction-lifecycle-row-actions";
import { validateInvoiceCancelEligibility } from "@/lib/invoice-payment-utils";
import type { TransactionLifecycleState } from "@/lib/transaction-lifecycle-policy";
import { mapInvoiceToLifecycle } from "@/lib/transaction-lifecycle-enforcement";

export { getInvoiceRowActions };

export function resolveInvoiceLifecycleState(input: {
  status: string;
  paymentStatus: string;
}): TransactionLifecycleState {
  return mapInvoiceToLifecycle(input);
}

export function resolveInvoiceDetailActions(input: {
  status: string;
  paymentStatus: string;
  type: string;
  paidAmount: number;
  total: number;
  documentSubmission?: { status: string; documentType: string } | null;
}) {
  const isEInvoice = input.type !== "NORMAL";
  const lifecycleActions = getInvoiceRowActions({
    status: input.status,
    paymentStatus: input.paymentStatus,
    isEInvoice,
  });

  const cancelEligibility = validateInvoiceCancelEligibility({
    status: input.status,
    paymentStatus: input.paymentStatus,
    paidAmount: input.paidAmount,
    total: input.total,
  });

  const submitted =
    input.documentSubmission?.status === "SUCCESS" ||
    input.documentSubmission?.status === "SUBMITTED";

  const canCancel =
    input.status !== "CANCELLED" &&
    input.status !== "APPROVED" &&
    cancelEligibility.ok &&
    lifecycleActions.cancel &&
    !(
      submitted &&
      input.documentSubmission?.documentType === "E_INVOICE"
    );

  const canDelete =
    input.status === "DRAFT" &&
    lifecycleActions.delete &&
    cancelEligibility.ok;

  const canEdit =
    lifecycleActions.edit &&
    input.status !== "CANCELLED" &&
    input.status !== "APPROVED";

  const requiresCancelReason =
    input.paymentStatus === "PAID" ||
    input.paymentStatus === "PARTIAL" ||
    input.status === "APPROVED" ||
    input.status === "SENT";

  const providerCancelSupported =
    input.documentSubmission?.documentType === "E_ARCHIVE" &&
    input.documentSubmission?.status === "SUCCESS";

  return {
    lifecycleActions,
    canCancel,
    canDelete,
    canEdit,
    requiresCancelReason,
    providerCancelSupported,
    requiresProviderCancel:
      submitted && input.documentSubmission?.documentType === "E_INVOICE",
  };
}
