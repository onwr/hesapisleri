import type { Prisma } from "@prisma/client";
import {
  buildLifecycleAuditMetadata,
  resolveModuleLifecycleActions,
  requiresCancelReason,
  type LifecycleActionMatrix,
  type TransactionLifecycleAction,
  type TransactionLifecycleState,
  type TransactionModuleKey,
} from "@/lib/transaction-lifecycle-policy";

export class LifecyclePolicyError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "LIFECYCLE_POLICY_VIOLATION") {
    super(message);
    this.name = "LifecyclePolicyError";
    this.status = status;
    this.code = code;
  }
}

export function mapExpenseToLifecycle(input: {
  status: string;
  paymentStatus: string;
}): TransactionLifecycleState {
  if (input.status === "CANCELLED") return "CANCELLED";
  if (input.paymentStatus === "PAID") return "PAID";
  if (input.status === "PENDING") return "PENDING";
  return "PENDING";
}

export function mapInvoiceToLifecycle(input: {
  status: string;
  paymentStatus: string;
}): TransactionLifecycleState {
  if (input.status === "CANCELLED") return "CANCELLED";
  if (input.status === "DRAFT") return "DRAFT";
  if (input.status === "APPROVED") return "POSTED";
  if (input.paymentStatus === "PAID") return "PAID";
  if (input.paymentStatus === "PARTIAL") return "POSTED";
  return "PENDING";
}

export function mapSaleToLifecycle(status: string): TransactionLifecycleState {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";
  if (status === "PENDING") return "PENDING";
  if (status === "COMPLETED") return "COMPLETED";
  return "PENDING";
}

export function mapWarehouseTransferToLifecycle(
  status: string
): TransactionLifecycleState {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";
  if (status === "COMPLETED") return "COMPLETED";
  return "PENDING";
}

export function mapEmployeeLeaveToLifecycle(
  status: string
): TransactionLifecycleState {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "PENDING") return "PENDING";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "CANCELLED";
  return "PENDING";
}

export function mapAccountTransactionToLifecycle(input: {
  title: string;
  note?: string | null;
  isLinked: boolean;
}): TransactionLifecycleState {
  const normalized = `${input.title} ${input.note ?? ""}`.toLocaleLowerCase("tr-TR");
  if (normalized.includes("iptal") || normalized.includes("[reversal]")) {
    return "CANCELLED";
  }
  if (input.isLinked) return "POSTED";
  return "POSTED";
}

export function getModuleLifecycleActions(input: {
  module: TransactionModuleKey;
  state: TransactionLifecycleState;
}): LifecycleActionMatrix {
  return resolveModuleLifecycleActions(input);
}

export function assertLifecycleAction(input: {
  module: TransactionModuleKey;
  state: TransactionLifecycleState;
  action: TransactionLifecycleAction;
  message?: string;
}) {
  const actions = resolveModuleLifecycleActions({
    module: input.module,
    state: input.state,
  });

  if (!actions[input.action]) {
    throw new LifecyclePolicyError(
      input.message ??
        "Bu işlem mevcut kayıt durumunda gerçekleştirilemez.",
      400
    );
  }
}

export function assertCancelReasonProvided(input: {
  state: TransactionLifecycleState;
  reason?: string | null;
}) {
  if (requiresCancelReason(input.state) && !input.reason?.trim()) {
    throw new LifecyclePolicyError("İptal nedeni zorunludur.", 400);
  }
}

export async function writeLifecycleActivityLog(
  client: Prisma.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    module: string;
    entityType: string;
    entityId: string;
    action: string;
    message: string;
    reason?: string;
    changedFields?: Record<string, { from: unknown; to: unknown }>;
    relatedTransactionIds?: string[];
  }
) {
  const metadata = buildLifecycleAuditMetadata({
    reason: input.reason,
    changedFields: input.changedFields,
  }) as Prisma.InputJsonValue | undefined;

  const enriched =
    metadata || input.relatedTransactionIds?.length
      ? ({
          ...(metadata && typeof metadata === "object" ? metadata : {}),
          ...(input.relatedTransactionIds?.length
            ? { relatedTransactionIds: input.relatedTransactionIds }
            : {}),
        } as Prisma.InputJsonValue)
      : undefined;

  await client.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      metadata: enriched,
    },
  });
}

export const LINKED_TRANSACTION_CANCEL_MESSAGE =
  "Bu hareket bağlı olduğu işlem üzerinden iptal edilmelidir.";

export function resolveLinkedTransactionSource(input: {
  expenseId?: string | null;
  invoiceId?: string | null;
  supplierId?: string | null;
  transferGroupId?: string | null;
  employeePaymentId?: string | null;
  title?: string;
  note?: string | null;
  type?: string;
}):
  | { linked: false }
  | {
      linked: true;
      source:
        | "expense"
        | "invoice"
        | "transfer"
        | "employee_payment"
        | "supplier"
        | "sale";
      entityId?: string;
      href?: string;
    } {
  if (input.expenseId) {
    return { linked: true, source: "expense", entityId: input.expenseId, href: `/expenses/${input.expenseId}` };
  }
  if (input.invoiceId) {
    return { linked: true, source: "invoice", entityId: input.invoiceId, href: `/invoices/${input.invoiceId}` };
  }
  if (input.employeePaymentId) {
    return {
      linked: true,
      source: "employee_payment",
      entityId: input.employeePaymentId,
    };
  }
  if (input.transferGroupId) {
    return { linked: true, source: "transfer", entityId: input.transferGroupId };
  }
  if (input.supplierId) {
    return { linked: true, source: "supplier", entityId: input.supplierId, href: `/suppliers/${input.supplierId}` };
  }

  const title = input.title?.toLocaleLowerCase("tr-TR") ?? "";
  const note = input.note?.toLocaleLowerCase("tr-TR") ?? "";

  if (title.includes("transfer") || input.type === "TRANSFER") {
    return { linked: true, source: "transfer" };
  }
  if (
    title.includes("satış") ||
    title.includes("satis") ||
    title.includes("tahsilat") ||
    input.type === "COLLECTION"
  ) {
    return { linked: true, source: "sale" };
  }
  if (title.includes("gider") || note.includes("gider") || input.type === "PAYMENT") {
    return { linked: true, source: "expense" };
  }

  return { linked: false };
}
