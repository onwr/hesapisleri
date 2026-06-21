import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  createAccountSchema,
  serializeManagedAccount,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/lib/account-utils";

export type AccountServiceResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; status: number; message: string; errors?: Record<string, string[]> };

const accountSelect = {
  id: true,
  name: true,
  type: true,
  bankName: true,
  branchName: true,
  iban: true,
  accountNumber: true,
  balance: true,
  currency: true,
  isDefault: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function findDuplicateAccountName(
  companyId: string,
  name: string,
  excludeId?: string
) {
  return db.account.findFirst({
    where: {
      companyId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

async function applyOpeningBalance(
  tx: Prisma.TransactionClient,
  input: {
    accountId: string;
    openingBalance: number;
    currency: string;
  }
) {
  const balance = roundCashMoney(input.openingBalance);

  if (balance === 0) {
    return 0;
  }

  if (balance > 0) {
    await tx.accountTransaction.create({
      data: {
        accountId: input.accountId,
        type: "INCOME",
        title: "Açılış bakiyesi",
        amount: balance,
        note: "Açılış bakiyesi",
      },
    });
  } else {
    await tx.accountTransaction.create({
      data: {
        accountId: input.accountId,
        type: "EXPENSE",
        title: "Açılış bakiyesi",
        amount: Math.abs(balance),
        note: "Açılış bakiyesi",
      },
    });
  }

  await tx.account.update({
    where: { id: input.accountId },
    data: { balance },
  });

  return balance;
}

export async function createCompanyAccount(
  companyId: string,
  userId: string,
  body: unknown
): Promise<AccountServiceResult> {
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "Bilgileri kontrol edin.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data as CreateAccountInput;
  const name = input.name.trim();

  const duplicate = await findDuplicateAccountName(companyId, name);
  if (duplicate) {
    return {
      ok: false,
      status: 409,
      message: "Bu isimde bir hesap zaten var.",
    };
  }

  const accountCount = await db.account.count({ where: { companyId } });
  const shouldDefault = input.isDefault || accountCount === 0;
  const openingBalance = roundCashMoney(input.openingBalance ?? 0);

  const account = await db.$transaction(async (tx) => {
    if (shouldDefault) {
      await tx.account.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.account.create({
      data: {
        companyId,
        name,
        type: input.type,
        bankName: input.bankName?.trim() || null,
        branchName: input.branchName?.trim() || null,
        iban: input.iban?.trim() || null,
        accountNumber: input.accountNumber?.trim() || null,
        currency: input.currency?.trim() || "TRY",
        balance: 0,
        isDefault: shouldDefault,
        description: input.description?.trim() || null,
        status: "ACTIVE",
      },
      select: accountSelect,
    });

    if (openingBalance !== 0) {
      await applyOpeningBalance(tx, {
        accountId: created.id,
        openingBalance,
        currency: created.currency,
      });
    }

    if (shouldDefault) {
      await tx.companySettings.updateMany({
        where: { companyId },
        data: {
          defaultCollectionAccountId: created.id,
        },
      });
    }

    return tx.account.findFirstOrThrow({
      where: { id: created.id },
      select: accountSelect,
    });
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "CREATE",
      module: "cash-bank",
      message: `Hesap oluşturuldu: ${account.name}`,
    },
  });

  return {
    ok: true,
    message: "Hesap oluşturuldu.",
    data: serializeManagedAccount(account),
  };
}

export async function updateCompanyAccount(
  companyId: string,
  userId: string,
  accountId: string,
  body: unknown
): Promise<AccountServiceResult> {
  const parsed = updateAccountSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "Bilgileri kontrol edin.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data as UpdateAccountInput;

  const account = await db.account.findFirst({
    where: { id: accountId, companyId },
  });

  if (!account) {
    return {
      ok: false,
      status: 404,
      message: "Hesap bulunamadı.",
    };
  }

  if (input.name) {
    const duplicate = await findDuplicateAccountName(
      companyId,
      input.name.trim(),
      accountId
    );
    if (duplicate) {
      return {
        ok: false,
        status: 409,
        message: "Bu isimde bir hesap zaten var.",
      };
    }
  }

  if (input.status === "PASSIVE" && account.isDefault) {
    return {
      ok: false,
      status: 400,
      message: "Varsayılan hesap pasif yapılamaz. Önce başka bir hesabı varsayılan yapın.",
    };
  }

  const updated = await db.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.account.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.account.update({
      where: { id: accountId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.bankName !== undefined
          ? { bankName: input.bankName?.trim() || null }
          : {}),
        ...(input.branchName !== undefined
          ? { branchName: input.branchName?.trim() || null }
          : {}),
        ...(input.iban !== undefined ? { iban: input.iban?.trim() || null } : {}),
        ...(input.accountNumber !== undefined
          ? { accountNumber: input.accountNumber?.trim() || null }
          : {}),
        ...(input.currency !== undefined
          ? { currency: input.currency.trim() || "TRY" }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: accountSelect,
    });
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "UPDATE",
      module: "cash-bank",
      message: `Hesap güncellendi: ${updated.name}`,
    },
  });

  return {
    ok: true,
    message: "Hesap güncellendi.",
    data: serializeManagedAccount(updated),
  };
}

export async function deactivateCompanyAccount(
  companyId: string,
  userId: string,
  accountId: string
): Promise<AccountServiceResult> {
  const account = await db.account.findFirst({
    where: { id: accountId, companyId },
    include: {
      _count: { select: { transactions: true } },
    },
  });

  if (!account) {
    return {
      ok: false,
      status: 404,
      message: "Hesap bulunamadı.",
    };
  }

  if (account.isDefault) {
    return {
      ok: false,
      status: 400,
      message: "Varsayılan hesap pasif yapılamaz. Önce başka bir hesabı varsayılan yapın.",
    };
  }

  await db.account.update({
    where: { id: accountId },
    data: { status: "PASSIVE" },
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "UPDATE",
      module: "cash-bank",
      message: `Hesap pasife alındı: ${account.name}`,
    },
  });

  return {
    ok: true,
    message: "Hesap pasife alındı.",
    data: { id: accountId },
  };
}

export async function setDefaultCompanyAccount(
  companyId: string,
  userId: string,
  accountId: string
): Promise<AccountServiceResult> {
  const account = await db.account.findFirst({
    where: { id: accountId, companyId },
  });

  if (!account) {
    return {
      ok: false,
      status: 404,
      message: "Hesap bulunamadı.",
    };
  }

  if (account.status !== "ACTIVE") {
    return {
      ok: false,
      status: 400,
      message: "Pasif hesap varsayılan yapılamaz.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.account.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { isDefault: true, status: "ACTIVE" },
    });

    await tx.companySettings.updateMany({
      where: { companyId },
      data: {
        defaultCollectionAccountId: accountId,
      },
    });
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "UPDATE",
      module: "cash-bank",
      message: `Varsayılan hesap değiştirildi: ${account.name}`,
    },
  });

  return {
    ok: true,
    message: "Varsayılan hesap güncellendi.",
    data: { id: accountId },
  };
}
