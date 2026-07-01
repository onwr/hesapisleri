import { db } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
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

  return serializeExpenseDetail(expense);
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

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "expenses",
        message: `${updated.title} gideri güncellendi.`,
      },
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
  }

  return result;
}

export async function cancelExpenseRecord(input: {
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
        status: 400,
        message: "Gider zaten iptal edilmiş.",
      };
    }

    if (expense.paymentStatus === "PAID" && expense.accountId && expense.account) {
      const amount = roundCashMoney(Number(expense.amount));
      const newBalance = roundCashMoney(Number(expense.account.balance) + amount);

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

    const cancelled = await tx.expense.update({
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
        userId: input.userId,
        action: "UPDATE",
        module: "expenses",
        message: `${expense.title} gideri iptal edildi.`,
      },
    });

    return {
      ok: true as const,
      data: cancelled,
      supplierId: expense.supplierId,
    };
  });

  if (result.ok) {
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
