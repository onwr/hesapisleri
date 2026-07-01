import { db } from "@/lib/prisma";
import {
  cancelExpenseRecord,
  createExpenseRecord,
  getExpenseDetail,
  updateExpenseRecord,
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/expense-service";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";

const PAGE_SIZE = 24;

function serializeExpenseListItem(expense: {
  id: string;
  title: string;
  category: string | null;
  supplier: string | null;
  amount: unknown;
  status: string;
  paymentStatus: string;
  date: Date;
  accountId: string | null;
}) {
  return {
    id: expense.id,
    title: expense.title,
    category: expense.category,
    supplierName: expense.supplier,
    date: expense.date.toISOString(),
    total: Number(expense.amount),
    paymentStatus: expense.paymentStatus,
    status: expense.status,
    accountId: expense.accountId,
  };
}

export async function listMobileExpenses(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  category?: string;
  paymentStatus?: string;
  status?: string;
  overdue?: boolean;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.expenses.read) {
    throw new MobileFinanceError("FORBIDDEN", "Gider görüntüleme yetkiniz yok.", 403);
  }

  const q = input.q?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const rows = await db.expense.findMany({
    where: {
      companyId: input.companyId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus as never } : {}),
      ...(input.status ? { status: input.status as never } : {}),
    },
    orderBy: { date: "desc" },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  let items = rows
    .filter((e) => {
      if (!q) return true;
      return (
        e.title.toLocaleLowerCase("tr-TR").includes(q) ||
        (e.category?.toLocaleLowerCase("tr-TR").includes(q) ?? false) ||
        (e.supplier?.toLocaleLowerCase("tr-TR").includes(q) ?? false)
      );
    })
    .map(serializeExpenseListItem);

  if (input.overdue) {
    items = items.filter((e) => e.paymentStatus === "UNPAID");
  }

  const hasMore = items.length > PAGE_SIZE;
  if (hasMore) items = items.slice(0, PAGE_SIZE);

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getMobileExpenseById(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  expenseId: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.expenses.read) {
    throw new MobileFinanceError("FORBIDDEN", "Gider görüntüleme yetkiniz yok.", 403);
  }

  const detail = await getExpenseDetail(input.companyId, input.expenseId);
  if (!detail) {
    throw new MobileFinanceError("EXPENSE_NOT_FOUND", "Gider bulunamadı.", 404);
  }

  return {
    permissions,
    expense: {
      id: detail.id,
      title: detail.title,
      category: detail.category,
      supplierName: detail.supplier,
      date: detail.date.toISOString(),
      total: detail.amount,
      paymentStatus: detail.paymentStatus,
      status: detail.status,
      note: detail.note,
      account: detail.account
        ? { id: detail.account.id, name: detail.account.name, type: detail.account.type }
        : null,
      movement: detail.accountTransaction
        ? {
            id: detail.accountTransaction.id,
            amount: detail.accountTransaction.amount,
            date: detail.accountTransaction.date.toISOString(),
            title: detail.accountTransaction.title,
          }
        : null,
    },
  };
}

export async function createMobileExpense(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.expenses.create) {
    throw new MobileFinanceError("FORBIDDEN", "Gider oluşturma yetkiniz yok.", 403);
  }

  const parsed = createExpenseSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  if (parsed.data.supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: parsed.data.supplierId, companyId: input.companyId, isActive: true },
    });
    if (!supplier) {
      throw new MobileFinanceError("SUPPLIER_NOT_FOUND", "Tedarikçi bulunamadı.", 404);
    }
  }

  if (parsed.data.accountId) {
    const account = await db.account.findFirst({
      where: { id: parsed.data.accountId, companyId: input.companyId },
    });
    if (!account) {
      throw new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", "Ödeme hesabı bulunamadı.", 404);
    }
  }

  const result = await createExpenseRecord({
    companyId: input.companyId,
    userId: input.userId,
    data: parsed.data,
  });

  if (!result.ok) {
    throw new MobileFinanceError("VALIDATION_ERROR", result.message, result.status);
  }

  return getMobileExpenseById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    expenseId: result.data.id,
  });
}

export async function updateMobileExpense(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  expenseId: string;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.expenses.update) {
    throw new MobileFinanceError("FORBIDDEN", "Gider güncelleme yetkiniz yok.", 403);
  }

  const parsed = updateExpenseSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const result = await updateExpenseRecord({
    companyId: input.companyId,
    userId: input.userId,
    expenseId: input.expenseId,
    data: parsed.data,
  });

  if (!result.ok) {
    const code = result.message.includes("iptal") ? "EXPENSE_ALREADY_PAID" : "VALIDATION_ERROR";
    throw new MobileFinanceError(code, result.message, result.status);
  }

  return getMobileExpenseById(input);
}

export async function cancelMobileExpense(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  expenseId: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.expenses.cancel) {
    throw new MobileFinanceError("FORBIDDEN", "Gider iptal yetkiniz yok.", 403);
  }

  const result = await cancelExpenseRecord({
    companyId: input.companyId,
    userId: input.userId,
    expenseId: input.expenseId,
  });

  if (!result.ok) {
    throw new MobileFinanceError("EXPENSE_NOT_FOUND", result.message, result.status);
  }

  return getMobileExpenseById(input);
}
