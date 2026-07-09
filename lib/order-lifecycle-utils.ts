import { getInvoiceRowActions } from "@/lib/transaction-lifecycle-row-actions";
import { validateInvoiceCancelEligibility } from "@/lib/invoice-payment-utils";

export function resolveOrderLifecycleActions(input: {
  sourceChannel: string;
  status: string;
  isArchived?: boolean;
}) {
  const isMarketplace =
    input.sourceChannel === "TRENDYOL" ||
    input.sourceChannel === "HEPSIBURADA" ||
    input.sourceChannel === "N11" ||
    input.sourceChannel === "AMAZON";

  if (isMarketplace) {
    return {
      isMarketplace: true,
      canHardDelete: false,
      canLocalCancel: false,
      canArchive: input.status !== "CANCELLED" && !input.isArchived,
      canRestore: Boolean(input.isArchived),
      canProviderCancel: false,
      lifecycleActions: {
        view: true,
        edit: false,
        delete: false,
        cancel: false,
        reverse: false,
        archive: input.status !== "CANCELLED" && !input.isArchived,
        restore: Boolean(input.isArchived),
      },
    };
  }

  const canCancel = input.status === "WAITING" || input.status === "APPROVED";
  const canEdit = input.status === "WAITING";
  const isArchived = Boolean(input.isArchived);

  return {
    isMarketplace: false,
    canHardDelete: input.status === "WAITING" && !isArchived,
    canLocalCancel: canCancel && !isArchived,
    canArchive: !isArchived && input.status !== "CANCELLED",
    canRestore: isArchived,
    canProviderCancel: false,
    lifecycleActions: {
      view: true,
      edit: canEdit && !isArchived,
      delete: input.status === "WAITING" && !isArchived,
      cancel: canCancel && !isArchived,
      reverse: false,
      archive: !isArchived && input.status !== "CANCELLED",
      restore: isArchived,
    },
  };
}

export { getInvoiceRowActions };
