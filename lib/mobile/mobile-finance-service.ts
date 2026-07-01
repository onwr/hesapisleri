import { db } from "@/lib/prisma";
import {
  applyAccountTransfer,
  getAccountDetailData,
  transferSchema,
} from "@/lib/cash-bank-account-service";
import { listCompanyAccounts } from "@/lib/account-read-service";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";

const MOVEMENT_PAGE_SIZE = 30;

export async function listMobileFinanceAccounts(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.finance.read) {
    throw new MobileFinanceError("FORBIDDEN", "Kasa/banka görüntüleme yetkiniz yok.", 403);
  }

  const accounts = await listCompanyAccounts(input.companyId);

  return {
    permissions,
    items: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      status: account.status,
      ...(permissions.finance.viewBalance ? { balance: Number(account.balance) } : {}),
      lastMovementAt: account.updatedAt.toISOString(),
    })),
  };
}

export async function getMobileFinanceAccountById(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  accountId: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.finance.read) {
    throw new MobileFinanceError("FORBIDDEN", "Kasa/banka görüntüleme yetkiniz yok.", 403);
  }

  const detail = await getAccountDetailData(input.companyId, input.accountId);
  if (!detail) {
    throw new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", "Hesap bulunamadı.", 404);
  }

  return {
    permissions,
    account: {
      id: detail.account.id,
      name: detail.account.name,
      type: detail.account.type,
      currency: detail.account.currency,
      status: detail.account.status,
      ...(permissions.finance.viewBalance
        ? { balance: detail.metrics.currentBalance }
        : {}),
      movements: detail.transactions.slice(0, MOVEMENT_PAGE_SIZE).map((m) => ({
        id: m.id,
        date: m.date.toISOString(),
        type: m.type,
        direction: m.direction,
        directionLabel: m.directionLabel,
        amount: m.amount,
        title: m.title,
        note: m.note,
        sourceLabel: m.sourceLabel,
        reference: m.reference,
      })),
    },
  };
}

export async function listMobileFinanceMovements(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  accountId?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.finance.read) {
    throw new MobileFinanceError("FORBIDDEN", "Finansal hareket görüntüleme yetkiniz yok.", 403);
  }

  const where = {
    account: { companyId: input.companyId },
    ...(input.accountId ? { accountId: input.accountId } : {}),
  };

  const rows = await db.accountTransaction.findMany({
    where,
    include: { account: { select: { id: true, name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: MOVEMENT_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > MOVEMENT_PAGE_SIZE;
  const items = (hasMore ? rows.slice(0, MOVEMENT_PAGE_SIZE) : rows).map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: row.account.name,
    date: row.date.toISOString(),
    type: row.type,
    amount: Number(row.amount),
    title: row.title,
    note: row.note,
    invoiceId: row.invoiceId,
    expenseId: row.expenseId,
  }));

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function transferMobileFinance(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.finance.transfer) {
    throw new MobileFinanceError("FORBIDDEN", "Transfer yetkiniz yok.", 403);
  }

  const parsed = transferSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  if (parsed.data.fromAccountId === parsed.data.toAccountId) {
    throw new MobileFinanceError("TRANSFER_SAME_ACCOUNT", "Kaynak ve hedef hesap farklı olmalıdır.", 400);
  }

  const [from, to] = await Promise.all([
    db.account.findFirst({ where: { id: parsed.data.fromAccountId, companyId: input.companyId } }),
    db.account.findFirst({ where: { id: parsed.data.toAccountId, companyId: input.companyId } }),
  ]);

  if (!from || !to) {
    throw new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", "Hesap bulunamadı.", 404);
  }

  const result = await applyAccountTransfer({
    companyId: input.companyId,
    userId: input.userId,
    data: parsed.data,
  });

  if (!result.ok) {
    const code = result.message.includes("yetersiz")
      ? "INSUFFICIENT_BALANCE"
      : result.message.includes("Kaynak")
        ? "TRANSFER_SAME_ACCOUNT"
        : "VALIDATION_ERROR";
    throw new MobileFinanceError(code, result.message, result.status);
  }

  return { transfer: { ok: true } };
}
