import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { cancelInvoiceDocument } from "@/lib/efaturam/efaturam-document-service";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import {
  getInvoiceEffectivePaidAmount,
  reverseCustomerDebtFromDocument,
} from "@/lib/customer-balance-utils";
import {
  assertCancelReasonProvided,
  assertLifecycleAction,
  mapInvoiceToLifecycle,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";
import {
  getInvoiceRowActions,
  resolveInvoiceLifecycleState,
} from "@/lib/invoice-lifecycle-utils";
import { validateInvoiceCancelEligibility } from "@/lib/invoice-payment-utils";
import { cancelSaleById } from "@/lib/sale-cancel-service";

type ServiceResult<T> =
  | { ok: true; data: T; replayed?: boolean; message?: string }
  | { ok: false; status: number; message: string };

const E_INVOICE_PROVIDER_CANCEL_MESSAGE =
  "Bu e-fatura sağlayıcı üzerinden iptal edilmelidir.";

function isSubmittedEDocument(invoice: {
  documentSubmission?: { status: string } | null;
}) {
  const status = invoice.documentSubmission?.status;
  return status === "SUCCESS" || status === "SUBMITTED";
}

export async function deleteInvoiceRecord(input: {
  companyId: string;
  userId: string;
  invoiceId: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, companyId: input.companyId },
    });

    if (!invoice) {
      return { ok: false as const, status: 404, message: "Fatura bulunamadı." };
    }

    const lifecycle = mapInvoiceToLifecycle({
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
    });

    try {
      assertLifecycleAction({
        module: invoice.type === "NORMAL" ? "invoices" : "e_invoices",
        state: lifecycle,
        action: "delete",
        message: "Bu fatura silinemez.",
      });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error ? error.message : "Bu fatura silinemez.",
      };
    }

    if (invoice.status !== "DRAFT") {
      return {
        ok: false as const,
        status: 400,
        message: "Yalnızca taslak faturalar silinebilir.",
      };
    }

    const effectivePaid = getInvoiceEffectivePaidAmount(invoice);
    if (effectivePaid > 0) {
      return {
        ok: false as const,
        status: 400,
        message: "Tahsilatı olan fatura silinemez.",
      };
    }

    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await tx.invoice.delete({ where: { id: invoice.id } });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "invoices",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "DELETE",
      message: `${invoice.invoiceNo} taslak faturası silindi.`,
    });

    return { ok: true as const, data: { invoiceId: invoice.id } };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "invoice-delete");
  }

  return result;
}

export async function cancelInvoiceRecord(input: {
  companyId: string;
  userId: string;
  invoiceId: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<ServiceResult<{ invoiceId: string }>> {
  const reason = input.reason?.trim();

  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, companyId: input.companyId },
    include: {
      sale: true,
      documentSubmission: true,
      transactions: true,
    },
  });

  if (!invoice) {
    return { ok: false, status: 404, message: "Fatura bulunamadı." };
  }

  if (invoice.status === "CANCELLED") {
    return {
      ok: false,
      status: 409,
      message: "Bu fatura zaten iptal edilmiş.",
    };
  }

  const lifecycle = mapInvoiceToLifecycle({
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
  });
  const moduleKey = invoice.type === "NORMAL" ? "invoices" : "e_invoices";

  try {
    assertLifecycleAction({
      module: moduleKey,
      state: lifecycle,
      action: "cancel",
      message: "Bu fatura iptal edilemez.",
    });
    assertCancelReasonProvided({ state: lifecycle, reason });
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message:
        error instanceof Error ? error.message : "Bu fatura iptal edilemez.",
    };
  }

  if (isSubmittedEDocument(invoice)) {
    if (invoice.documentSubmission?.documentType === "E_INVOICE") {
      return {
        ok: false,
        status: 400,
        message: E_INVOICE_PROVIDER_CANCEL_MESSAGE,
      };
    }

    if (
      invoice.documentSubmission?.documentType === "E_ARCHIVE" &&
      invoice.documentSubmission.status === "SUCCESS"
    ) {
      try {
        await cancelInvoiceDocument({
          companyId: input.companyId,
          invoiceId: invoice.id,
        });

        await db.$transaction(async (tx) => {
          await writeLifecycleActivityLog(tx, {
            companyId: input.companyId,
            userId: input.userId,
            module: "invoices",
            entityType: "INVOICE",
            entityId: invoice.id,
            action: "CANCEL",
            message: `${invoice.invoiceNo} e-Arşiv belgesi sağlayıcı üzerinden iptal edildi.`,
            reason,
          });
        });

        invalidateDashboardCache(input.companyId, "invoice-cancel");
        return {
          ok: true,
          data: { invoiceId: invoice.id },
          message: "E-Arşiv belgesi iptal edildi.",
        };
      } catch (error) {
        return {
          ok: false,
          status: 400,
          message:
            error instanceof Error
              ? error.message
              : "E-Arşiv belgesi sağlayıcı üzerinden iptal edilemedi.",
        };
      }
    }
  }

  if (invoice.status === "APPROVED" && invoice.type !== "NORMAL") {
    return {
      ok: false,
      status: 400,
      message: E_INVOICE_PROVIDER_CANCEL_MESSAGE,
    };
  }

  const cancelEligibility = validateInvoiceCancelEligibility(invoice);
  if (!cancelEligibility.ok) {
    return { ok: false, status: 400, message: cancelEligibility.message };
  }

  if (invoice.saleId) {
    const saleResult = await cancelSaleById(
      invoice.saleId,
      input.companyId,
      input.userId,
      { reason: reason ?? "Fatura iptali" }
    );

    if (!saleResult.ok) {
      return {
        ok: false,
        status: saleResult.status,
        message: saleResult.message,
      };
    }

    invalidateDashboardCache(input.companyId, "invoice-cancel");
    return {
      ok: true,
      data: { invoiceId: invoice.id },
      message: saleResult.message,
    };
  }

  const result = await db.$transaction(async (tx) => {
    const effectivePaid = getInvoiceEffectivePaidAmount(invoice);

    await reverseCustomerDebtFromDocument(
      tx,
      input.companyId,
      invoice.customerId,
      Number(invoice.total),
      effectivePaid
    );

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
      },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "invoices",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "CANCEL",
      message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
      reason,
    });

    await createNotification(
      {
        companyId: input.companyId,
        userId: input.userId,
        type: "WARNING",
        category: "INVOICES",
        module: "invoices",
        entityType: "INVOICE",
        entityId: invoice.id,
        actionUrl: `/invoices/${invoice.id}`,
        title: "Fatura iptal edildi",
        message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
      },
      tx
    );

    return { ok: true as const, data: { invoiceId: invoice.id } };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "invoice-cancel");
  }

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data,
    message: "Fatura başarıyla iptal edildi.",
  };
}

export function getInvoiceLifecycleContext(invoice: {
  status: string;
  paymentStatus: string;
  type: string;
  documentSubmission?: { status: string; documentType: string } | null;
}) {
  const state = resolveInvoiceLifecycleState(invoice);
  const isEInvoice = invoice.type !== "NORMAL";
  const actions = getInvoiceRowActions({
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    isEInvoice,
  });

  const providerCancelSupported =
    invoice.documentSubmission?.documentType === "E_ARCHIVE" &&
    invoice.documentSubmission?.status === "SUCCESS";

  const requiresProviderCancel =
    isSubmittedEDocument(invoice) &&
    invoice.documentSubmission?.documentType === "E_INVOICE";

  return {
    lifecycleActions: actions,
    requiresCancelReason:
      state === "PAID" ||
      state === "POSTED" ||
      state === "COMPLETED" ||
      invoice.paymentStatus === "PAID" ||
      invoice.paymentStatus === "PARTIAL",
    providerCancelSupported,
    requiresProviderCancel,
    providerCancelMessage: E_INVOICE_PROVIDER_CANCEL_MESSAGE,
  };
}
