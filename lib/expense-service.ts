import { db } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  buildFinanceMirrorNote,
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import {
  assertCancelReasonProvided,
  assertLifecycleAction,
  mapExpenseToLifecycle,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";
import { runExpenseCancelTestHook } from "@/lib/test-transaction-hooks";
import { getExpenseRowActions } from "@/lib/transaction-lifecycle-row-actions";
import { getSupplierDisplayName } from "@/lib/supplier-utils";
import {
  ensureExpenseCategoryExists,
  getActiveExpenseCategoryNames,
} from "@/lib/expense-category-service";
import {
  buildExpensePaymentTransactionTitle,
  buildExpenseTransactionTitle,
  createExpenseSchema,
  isCancelledExpense,
  normalizeExpenseCategory,
  parseExpenseDate,
  payExpenseSchema,
  validateExpenseAmountUpdate,
  validateExpensePayEligibility,
  updateExpenseSchema,
  type CreateExpenseInput,
  type PayExpenseInput,
  type UpdateExpenseInput,
} from "@/lib/expense-utils";
import {
  getCompanyAllowNegativeCashBalance,
  hasInsufficientCashBalance,
  INSUFFICIENT_CASH_BALANCE_MESSAGE,
} from "@/lib/cash-balance-policy";

export {
  createExpenseSchema,
  payExpenseSchema,
  updateExpenseSchema,
} from "@/lib/expense-utils";

export type SerializedExpenseAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

export type SerializedExpenseDetail = {
  id: string;
  title: string;
  category: string | null;
  supplier: string | null;
  amount: number;
  status: string;
  paymentStatus: string;
  date: Date;
  note: string | null;
  account: SerializedExpenseAccount | null;
  accountTransaction: {
    id: string;
    title: string;
    amount: number;
    date: Date;
    note: string | null;
  } | null;
  lifecycleActions?: import("@/lib/transaction-lifecycle-policy").LifecycleActionMatrix;
  requiresCancelReason?: boolean;
};

import { getActiveAccountOptions } from "@/lib/account-read-service";

export async function getExpenseFormAccounts(companyId: string) {
  return getActiveAccountOptions(companyId);
}

export async function getExpenseCategoryOptions(companyId: string) {
  return getActiveExpenseCategoryNames(companyId);
}

export async function getExpenseDetail(companyId: string, expenseId: string) {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, companyId },
    include: {
      account: true,
      accountTransaction: true,
    },
  });

  if (!expense) {
    return null;
  }

  const detail = serializeExpenseDetail(expense);
  const lifecycleActions = getExpenseRowActions({
    status: expense.status,
    paymentStatus: expense.paymentStatus,
  });

  return {
    ...detail,
    lifecycleActions,
    requiresCancelReason: expense.paymentStatus === "PAID",
  };
}

function serializeExpenseDetail(expense: {
  id: string;
  title: string;
  category: string | null;
  supplier: string | null;
  amount: unknown;
  status: string;
  paymentStatus: string;
  date: Date;
  note: string | null;
  account: {
    id: string;
    name: string;
    type: string;
    balance: unknown;
  } | null;
  accountTransaction: {
    id: string;
    title: string;
    amount: unknown;
    date: Date;
    note: string | null;
  } | null;
}): SerializedExpenseDetail {
  return {
    id: expense.id,
    title: expense.title,
    category: expense.category,
    supplier: expense.supplier,
    amount: Number(expense.amount),
    status: expense.status,
    paymentStatus: expense.paymentStatus,
    date: expense.date,
    note: expense.note,
    account: expense.account
      ? {
          id: expense.account.id,
          name: expense.account.name,
          type: expense.account.type,
          balance: Number(expense.account.balance),
        }
      : null,
    accountTransaction: expense.accountTransaction
      ? {
          id: expense.accountTransaction.id,
          title: expense.accountTransaction.title,
          amount: Number(expense.accountTransaction.amount),
          date: expense.accountTransaction.date,
          note: expense.accountTransaction.note,
        }
      : null,
  };
}

async function resolveExpenseSupplier(
  companyId: string,
  data: { supplierId?: string; supplier?: string | null }
) {
  if (data.supplierId?.trim()) {
    const supplier = await db.supplier.findFirst({
      where: { id: data.supplierId.trim(), companyId, isActive: true },
    });

    if (supplier) {
      return {
        supplierId: supplier.id,
        supplier: getSupplierDisplayName(supplier),
      };
    }
  }

  return {
    supplierId: null as string | null,
    supplier: data.supplier?.trim() || null,
  };
}

export async function createExpenseRecord(input: {
  companyId: string;
  userId: string;
  data: CreateExpenseInput;
}) {
  const expenseDate = parseExpenseDate(input.data.date);
  if (!expenseDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir gider tarihi girin.",
    };
  }

  const amount = roundCashMoney(input.data.amount);
  const category = normalizeExpenseCategory(input.data.category);
  await ensureExpenseCategoryExists(input.companyId, category);
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  const result = await db.$transaction(async (tx) => {
    if (input.data.paymentStatus === "PAID") {
      const account = await tx.account.findFirst({
        where: {
          id: input.data.accountId,
          companyId: input.companyId,
          status: "ACTIVE",
        },
      });

      if (!account) {
        return {
          ok: false as const,
          status: 404,
          message: "Ödeme hesabı bulunamadı.",
        };
      }
    }

    const supplierFields = await resolveExpenseSupplier(input.companyId, input.data);

    const expense = await tx.expense.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        title: input.data.title.trim(),
        category,
        supplier: supplierFields.supplier,
        supplierId: supplierFields.supplierId,
        amount,
        status: "APPROVED",
        paymentStatus: input.data.paymentStatus,
        accountId:
          input.data.paymentStatus === "PAID" ? input.data.accountId : null,
        date: expenseDate,
        note: input.data.note?.trim() || null,
      },
    });

    if (input.data.paymentStatus === "PAID" && input.data.accountId) {
      const account = await tx.account.findFirstOrThrow({
        where: { id: input.data.accountId },
      });

      if (
        hasInsufficientCashBalance(
          account.balance,
          amount,
          allowNegativeCashBalance
        )
      ) {
        return {
          ok: false as const,
          status: 400,
          message: INSUFFICIENT_CASH_BALANCE_MESSAGE,
        };
      }

      const newBalance = roundCashMoney(Number(account.balance) - amount);

      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          type: "EXPENSE",
          title: buildExpenseTransactionTitle(expense.title),
          amount,
          date: expenseDate,
          note: expense.note,
          expenseId: expense.id,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });
    }

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        module: "expenses",
        message: `${expense.title} gideri oluşturuldu (${input.data.paymentStatus === "PAID" ? "ödendi" : "ödenmedi"}).`,
      },
    });

    return {
      ok: true as const,
      data: expense,
    };
  });

  if (result.ok && result.data.supplierId) {
    await syncSupplierBalance(input.companyId, result.data.supplierId);
  }

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "expense-create");
  }

  return result;
}

export async function updateExpenseRecord(input: {
  companyId: string;
  userId: string;
  expenseId: string;
  data: UpdateExpenseInput;
}) {
  const expenseDate = parseExpenseDate(input.data.date);
  if (!expenseDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir gider tarihi girin.",
    };
  }

  const category = normalizeExpenseCategory(input.data.category);
  await ensureExpenseCategoryExists(input.companyId, category);

  const result = await db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: {
        id: input.expenseId,
        companyId: input.companyId,
      },
      include: {
        accountTransaction: true,
      },
    });

    if (!expense) {
      return {
        ok: false as const,
        status: 404,
        message: "Gider bulunamadı.",
      };
    }

    const previousSupplierId = expense.supplierId;

    if (isCancelledExpense(expense.status)) {
      return {
        ok: false as const,
        status: 400,
        message: "İptal edilmiş gider düzenlenemez.",
      };
    }

    const lifecycle = mapExpenseToLifecycle({
      status: expense.status,
      paymentStatus: expense.paymentStatus,
    });

    try {
      assertLifecycleAction({
        module: "expenses",
        state: lifecycle,
        action: "edit",
        message: "Bu gider düzenlenemez.",
      });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error ? error.message : "Bu gider düzenlenemez.",
      };
    }

    const amountValidation = validateExpenseAmountUpdate(expense, input.data.amount);
    if (!amountValidation.ok) {
      return {
        ok: false as const,
        status: 400,
        message: amountValidation.message,
      };
    }

    const supplierFields = await resolveExpenseSupplier(input.companyId, input.data);

    const updateData: {
      title: string;
      category: string;
      supplier: string | null;
      supplierId: string | null;
      date: Date;
      note: string | null;
      amount?: number;
    } = {
      title: input.data.title.trim(),
      category,
      supplier: supplierFields.supplier,
      supplierId: supplierFields.supplierId,
      date: expenseDate,
      note: input.data.note?.trim() || null,
    };

    if (input.data.amount !== undefined) {
      updateData.amount = roundCashMoney(input.data.amount);
    }

    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: updateData,
    });

    if (expense.accountTransaction) {
      await tx.accountTransaction.update({
        where: { id: expense.accountTransaction.id },
        data: {
          title: buildExpenseTransactionTitle(updated.title),
          date: expenseDate,
          note: updated.note,
        },
      });
    }

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "expenses",
      entityType: "EXPENSE",
      entityId: updated.id,
      action: "UPDATE",
      message: `${updated.title} gideri güncellendi.`,
    });

    return {
      ok: true as const,
      data: updated,
      previousSupplierId,
    };
  });

  if (result.ok) {
    const supplierIds = new Set(
      [result.previousSupplierId, result.data.supplierId].filter(Boolean) as string[]
    );
    for (const supplierId of supplierIds) {
      await syncSupplierBalance(input.companyId, supplierId);
    }
    invalidateDashboardCache(input.companyId, "expense-update");
  }

  return result;
}

export async function deleteExpenseRecord(input: {
  companyId: string;
  userId: string;
  expenseId: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: {
        id: input.expenseId,
        companyId: input.companyId,
      },
    });

    if (!expense) {
      return {
        ok: false as const,
        status: 404,
        message: "Gider bulunamadı.",
      };
    }

    const lifecycle = mapExpenseToLifecycle({
      status: expense.status,
      paymentStatus: expense.paymentStatus,
    });

    try {
      assertLifecycleAction({
        module: "expenses",
        state: lifecycle,
        action: "delete",
        message: "Bu gider silinemez.",
      });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error ? error.message : "Bu gider silinemez.",
      };
    }

    if (expense.paymentStatus === "PAID") {
      return {
        ok: false as const,
        status: 400,
        message: "Ödenmiş gider silinemez. İptal veya ters kayıt kullanın.",
      };
    }

    await tx.expense.delete({ where: { id: expense.id } });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "expenses",
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "DELETE",
      message: `${expense.title} gideri silindi.`,
    });

    return {
      ok: true as const,
      data: { expenseId: expense.id },
      supplierId: expense.supplierId,
    };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "expense-delete");
    if (result.supplierId) {
      await syncSupplierBalance(input.companyId, result.supplierId);
    }
  }

  return result;
}

export async function cancelExpenseRecord(input: {
  companyId: string;
  userId: string;
  expenseId: string;
  reason?: string;
}) {
  const reason = input.reason?.trim();

  const result = await db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: {
        id: input.expenseId,
        companyId: input.companyId,
      },
      include: {
        account: true,
        accountTransaction: true,
      },
    });

    if (!expense) {
      return {
        ok: false as const,
        status: 404,
        message: "Gider bulunamadı.",
      };
    }

    if (isCancelledExpense(expense.status)) {
      return {
        ok: false as const,
        status: 409,
        message: "Gider zaten iptal edilmiş.",
      };
    }

    const lifecycle = mapExpenseToLifecycle({
      status: expense.status,
      paymentStatus: expense.paymentStatus,
    });

    try {
      assertLifecycleAction({
        module: "expenses",
        state: lifecycle,
        action: "cancel",
        message: "Bu gider iptal edilemez.",
      });
      assertCancelReasonProvided({ state: lifecycle, reason });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error ? error.message : "Bu gider iptal edilemez.",
      };
    }

    const relatedTransactionIds: string[] = [];

    if (expense.paymentStatus === "PAID" && expense.accountId && expense.account) {
      const amount = roundCashMoney(Number(expense.amount));
      const sourceTx = expense.accountTransaction;

      if (sourceTx && isFinanceMirrorTransaction(sourceTx)) {
        return {
          ok: false as const,
          status: 409,
          message: "Bu gider zaten iptal edilmiş.",
        };
      }

      if (sourceTx) {
        // Mirror bağ: note içindeki kaynak transaction id.
        // expenseId @unique — ters kayıt orijinal bire bir FK'yi tekrar kullanamaz.
        const mirrorExists = await tx.accountTransaction.findFirst({
          where: {
            accountId: expense.accountId,
            type: "INCOME",
            note: { contains: sourceTx.id },
          },
        });

        if (mirrorExists) {
          return {
            ok: true as const,
            data: await tx.expense.findFirstOrThrow({
              where: { id: expense.id },
            }),
            supplierId: expense.supplierId,
            replayed: true,
          };
        }

        relatedTransactionIds.push(sourceTx.id);

        const reversal = await tx.accountTransaction.create({
          data: {
            accountId: expense.accountId,
            type: "INCOME",
            title: `Gider İptali - ${expense.title}`,
            amount,
            date: new Date(),
            note: buildFinanceMirrorNote(
              "REVERSAL",
              `${expense.title} gideri iptal edildi. Kaynak: ${sourceTx.id}. Neden: ${reason ?? "Belirtilmedi"}`
            ),
          },
        });

        relatedTransactionIds.push(reversal.id);

        // Test-only hook (no-op in production): inject failure after first finance write.
        runExpenseCancelTestHook();

        await tx.account.update({
          where: { id: expense.account.id },
          data: {
            balance: roundCashMoney(Number(expense.account.balance) + amount),
          },
        });
      }
    }

    const cancelled = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "UNPAID",
        accountId: null,
      },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "expenses",
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "CANCEL",
      message: `${expense.title} gideri iptal edildi.`,
      reason,
      relatedTransactionIds:
        relatedTransactionIds.length > 0 ? relatedTransactionIds : undefined,
    });

    return {
      ok: true as const,
      data: cancelled,
      supplierId: expense.supplierId,
    };
  });

  if (result.ok && !("replayed" in result && result.replayed)) {
    invalidateDashboardCache(input.companyId, "expense-cancel");
    if (result.supplierId) {
      await syncSupplierBalance(input.companyId, result.supplierId);
    }
  }

  return result;
}

export async function payExpenseRecord(input: {
  companyId: string;
  userId: string;
  expenseId: string;
  data: PayExpenseInput;
}) {
  const paymentDate = input.data.paidAt?.trim()
    ? parseExpenseDate(input.data.paidAt)
    : new Date();

  if (input.data.paidAt?.trim() && !paymentDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir ödeme tarihi girin.",
    };
  }

  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  const result = await db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: {
        id: input.expenseId,
        companyId: input.companyId,
      },
      include: {
        accountTransaction: true,
      },
    });

    if (!expense) {
      return {
        ok: false as const,
        status: 404,
        message: "Gider bulunamadı.",
      };
    }

    const eligibility = validateExpensePayEligibility(expense);
    if (!eligibility.ok) {
      return {
        ok: false as const,
        status: 400,
        message: eligibility.message,
      };
    }

    const account = await tx.account.findFirst({
      where: {
        id: input.data.accountId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    });

    if (!account) {
      return {
        ok: false as const,
        status: 404,
        message: "Ödeme hesabı bulunamadı.",
      };
    }

    const amount = roundCashMoney(Number(expense.amount));
    const paymentNote = input.data.note?.trim() || expense.note;

    if (
      hasInsufficientCashBalance(
        account.balance,
        amount,
        allowNegativeCashBalance
      )
    ) {
      return {
        ok: false as const,
        status: 400,
        message: INSUFFICIENT_CASH_BALANCE_MESSAGE,
      };
    }

    const newBalance = roundCashMoney(Number(account.balance) - amount);

    await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "EXPENSE",
        title: buildExpensePaymentTransactionTitle(expense.title),
        amount,
        date: paymentDate!,
        note: paymentNote,
        expenseId: expense.id,
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        paymentStatus: "PAID",
        accountId: account.id,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "expenses",
        message: `${expense.title} gideri ödendi (${account.name}).`,
      },
    });

    return {
      ok: true as const,
      data: updated,
    };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "expense-pay");
    const paid = result.data;
    if (paid.supplierId) {
      const { syncSupplierBalanceAfterExpenseChange } = await import(
        "@/lib/supplier-finance-service"
      );
      await syncSupplierBalanceAfterExpenseChange(
        input.companyId,
        paid.supplierId
      );
    }
  }

  return result;
}
