import type { EmployeePaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import {
  canCancelByLifecycleState,
  canEditByLifecycleState,
  mapEmployeePaymentStatusToLifecycle,
  buildLifecycleAuditMetadata,
  requiresCancelReason,
} from "@/lib/transaction-lifecycle-policy";
import { getEmployeePaymentTypeBehavior } from "@/lib/employee-payment-type-mapping";
import {
  EMPLOYEE_PAYMENT_VALIDATION_MESSAGES,
  parseEmployeePaymentAmount,
  validateEmployeePaymentAccount,
} from "@/lib/employee-payment-validation";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import { formatMoney } from "@/lib/format-utils";
import { EmployeeServiceError } from "@/lib/employee-service-error";

type DbClient = Prisma.TransactionClient;

async function logEmployeePaymentActivity(
  client: DbClient,
  input: {
    companyId: string;
    userId: string;
    action: string;
    message: string;
    entityId: string;
    reason?: string;
    changedFields?: Record<string, { from: unknown; to: unknown }>;
  }
) {
  await client.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      module: "employees",
      entityType: "EMPLOYEE_PAYMENT",
      entityId: input.entityId,
      message: input.message,
      metadata: buildLifecycleAuditMetadata({
        reason: input.reason,
        changedFields: input.changedFields,
      }) as Prisma.InputJsonValue | undefined,
    },
  });
}

async function getEmployeePaymentForMutation(input: {
  companyId: string;
  employeeId: string;
  paymentId: string;
}) {
  const payment = await db.employeePayment.findFirst({
    where: {
      id: input.paymentId,
      employeeId: input.employeeId,
      companyId: input.companyId,
    },
    include: {
      employee: true,
      payrollRunItem: {
        include: {
          payrollRun: { select: { id: true, status: true, title: true } },
        },
      },
      relatedExpense: {
        include: { accountTransaction: true },
      },
      relatedAccount: true,
      relatedTransaction: true,
    },
  });

  if (!payment) {
    throw new EmployeeServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  return payment;
}

function assertPaymentEditable(status: EmployeePaymentStatus) {
  const lifecycle = mapEmployeePaymentStatusToLifecycle(status);
  if (!canEditByLifecycleState(lifecycle)) {
    throw new EmployeeServiceError(
      "Bu ödeme kaydı düzenlenemez. Yalnızca bekleyen kayıtlar düzenlenebilir."
    );
  }
}

function assertPaymentCancellable(status: EmployeePaymentStatus) {
  const lifecycle = mapEmployeePaymentStatusToLifecycle(status);
  if (!canCancelByLifecycleState(lifecycle)) {
    throw new EmployeeServiceError("Bu ödeme kaydı iptal edilemez.");
  }
}

function assertNotLinkedToPaidPayroll(
  payment: Awaited<ReturnType<typeof getEmployeePaymentForMutation>>
) {
  const payrollItem = payment.payrollRunItem;
  if (!payrollItem) return;

  if (payrollItem.payrollRun.status === "PAID") {
    throw new EmployeeServiceError(
      `${payrollItem.payrollRun.title} bordrosuna bağlı ödenmiş kayıt iptal edilemez.`
    );
  }
}

async function reversePaidEmployeePaymentFinance(
  tx: DbClient,
  input: {
    companyId: string;
    actorUserId: string;
    payment: Awaited<ReturnType<typeof getEmployeePaymentForMutation>>;
    reason: string;
  }
) {
  const amount = roundCashMoney(Number(input.payment.amount));

  if (input.payment.relatedExpenseId) {
    const expense = await tx.expense.findFirst({
      where: {
        id: input.payment.relatedExpenseId,
        companyId: input.companyId,
      },
      include: { accountTransaction: true, account: true },
    });

    if (expense && expense.status !== "CANCELLED") {
      if (
        expense.paymentStatus === "PAID" &&
        expense.accountId &&
        expense.account
      ) {
        const newBalance = roundCashMoney(
          Number(expense.account.balance) + amount
        );
        await tx.account.update({
          where: { id: expense.account.id },
          data: { balance: newBalance },
        });

        if (expense.accountTransaction) {
          await tx.accountTransaction.delete({
            where: { id: expense.accountTransaction.id },
          });
        }
      }

      await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "UNPAID",
          accountId: null,
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.actorUserId,
          action: "UPDATE",
          module: "expenses",
          entityType: "EXPENSE",
          entityId: expense.id,
          message: `${expense.title} gideri çalışan ödemesi iptali ile iptal edildi.`,
          metadata: buildLifecycleAuditMetadata({ reason: input.reason }) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
    }
  } else if (input.payment.relatedTransactionId && input.payment.relatedAccount) {
    const account = input.payment.relatedAccount;
    const newBalance = roundCashMoney(Number(account.balance) + amount);

    await tx.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    await tx.accountTransaction.delete({
      where: { id: input.payment.relatedTransactionId },
    });
  }
}

export async function updateEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  paymentId: string;
  amount?: unknown;
  dueDate?: string | null;
  description?: string | null;
  relatedAccountId?: string | null;
}) {
  const existing = await getEmployeePaymentForMutation(input);
  assertPaymentEditable(existing.status);
  assertNotLinkedToPaidPayroll(existing);

  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  const data: Prisma.EmployeePaymentUpdateInput = {};

  if (input.amount !== undefined) {
    const parsed = parseEmployeePaymentAmount(input.amount);
    if (!parsed.ok) {
      throw new EmployeeServiceError(parsed.message);
    }
    if (parsed.amount !== Number(existing.amount)) {
      changedFields.amount = {
        from: Number(existing.amount),
        to: parsed.amount,
      };
      data.amount = parsed.amount;
    }
  }

  if (input.dueDate !== undefined) {
    const nextDue =
      input.dueDate && input.dueDate.trim()
        ? new Date(input.dueDate)
        : null;
    const prevIso = existing.dueDate?.toISOString() ?? null;
    const nextIso = nextDue?.toISOString() ?? null;
    if (prevIso !== nextIso) {
      changedFields.dueDate = { from: prevIso, to: nextIso };
      data.dueDate = nextDue;
    }
  }

  if (input.description !== undefined) {
    const nextDescription = input.description?.trim() || null;
    if (nextDescription !== existing.description) {
      changedFields.description = {
        from: existing.description,
        to: nextDescription,
      };
      data.description = nextDescription;
    }
  }

  if (input.relatedAccountId !== undefined) {
    const accountId = input.relatedAccountId?.trim() || null;
    const typeBehavior = getEmployeePaymentTypeBehavior(existing.type);

    if (
      typeBehavior.requiresAccountToDisburse &&
      !typeBehavior.allowPendingWithoutAccount &&
      !accountId
    ) {
      throw new EmployeeServiceError(
        EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired
      );
    }

    if (accountId) {
      const account = await db.account.findFirst({
        where: { id: accountId, companyId: input.companyId },
      });
      const validation = validateEmployeePaymentAccount(
        account,
        input.companyId,
        { paymentCurrency: existing.currency }
      );
      if (!validation.ok) {
        throw new EmployeeServiceError(validation.message);
      }
    }

    if (accountId !== existing.relatedAccountId) {
      changedFields.relatedAccountId = {
        from: existing.relatedAccountId,
        to: accountId,
      };
      data.relatedAccount = accountId
        ? { connect: { id: accountId } }
        : { disconnect: true };
    }
  }

  if (Object.keys(changedFields).length === 0) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    const payment = await tx.employeePayment.update({
      where: { id: existing.id },
      data,
      include: {
        relatedAccount: {
          select: { id: true, name: true, type: true, currency: true },
        },
      },
    });

    await logEmployeePaymentActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "UPDATE",
      entityId: payment.id,
      message: `${formatEmployeeDisplayName(existing.employee)} için ${formatMoney(Number(payment.amount))} çalışan ödemesi güncellendi.`,
      changedFields,
    });

    return payment;
  });
}

export async function cancelEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  paymentId: string;
  reason?: string;
}) {
  const existing = await getEmployeePaymentForMutation(input);
  assertPaymentCancellable(existing.status);
  assertNotLinkedToPaidPayroll(existing);

  if (existing.status === "CANCELLED") {
    throw new EmployeeServiceError("Ödeme kaydı zaten iptal edilmiş.");
  }

  const lifecycle = mapEmployeePaymentStatusToLifecycle(existing.status);
  if (requiresCancelReason(lifecycle) && !input.reason?.trim()) {
    throw new EmployeeServiceError("İptal nedeni zorunludur.");
  }

  const reason = input.reason?.trim() || "İptal";

  if (existing.status === "PENDING" || existing.status === "OVERDUE") {
    const cancelled = await db.$transaction(async (tx) => {
      const payment = await tx.employeePayment.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
        include: {
          relatedAccount: {
            select: { id: true, name: true, type: true, currency: true },
          },
        },
      });

      await logEmployeePaymentActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "CANCEL",
        entityId: payment.id,
        message: `${formatEmployeeDisplayName(existing.employee)} için bekleyen çalışan ödemesi iptal edildi.`,
        reason,
      });

      return payment;
    });

    invalidateDashboardCache(input.companyId, "employee-payment-cancel");
    return cancelled;
  }

  if (existing.status === "PAID") {
    const cancelled = await db.$transaction(async (tx) => {
      await reversePaidEmployeePaymentFinance(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        payment: existing,
        reason,
      });

      const payment = await tx.employeePayment.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED",
          relatedExpenseId: null,
          relatedTransactionId: null,
          relatedAccountId: null,
        },
        include: {
          relatedAccount: {
            select: { id: true, name: true, type: true, currency: true },
          },
        },
      });

      await logEmployeePaymentActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "CANCEL",
        entityId: payment.id,
        message: `${formatEmployeeDisplayName(existing.employee)} için ödenmiş çalışan ödemesi iptal edildi (ters kayıt).`,
        reason,
      });

      return payment;
    });

    invalidateDashboardCache(input.companyId, "employee-payment-cancel");
    return cancelled;
  }

  throw new EmployeeServiceError("Bu ödeme kaydı iptal edilemez.");
}

export async function deletePendingEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  paymentId: string;
}) {
  const existing = await getEmployeePaymentForMutation(input);
  const lifecycle = mapEmployeePaymentStatusToLifecycle(existing.status);

  if (lifecycle !== "PENDING" && lifecycle !== "OVERDUE") {
    throw new EmployeeServiceError(
      "Yalnızca bekleyen ödeme kayıtları silinebilir. Ödenmiş kayıtlar için iptal kullanın."
    );
  }

  assertNotLinkedToPaidPayroll(existing);

  await db.$transaction(async (tx) => {
    await logEmployeePaymentActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "DELETE",
      entityId: existing.id,
      message: `${formatEmployeeDisplayName(existing.employee)} için bekleyen çalışan ödemesi silindi.`,
    });

    await tx.employeePayment.delete({ where: { id: existing.id } });
  });

  invalidateDashboardCache(input.companyId, "employee-payment-delete");
  return { deleted: true as const };
}
