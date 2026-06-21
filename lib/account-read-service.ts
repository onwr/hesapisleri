import { db } from "@/lib/prisma";
import {
  serializeManagedAccount,
  serializeAccountOption,
} from "@/lib/account-utils";

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

export async function getActiveAccountOptions(companyId: string) {
  const accounts = await db.account.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      balance: true,
      currency: true,
      isDefault: true,
    },
  });

  return accounts.map(serializeAccountOption);
}

export async function listCompanyAccounts(companyId: string) {
  const accounts = await db.account.findMany({
    where: { companyId },
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    select: accountSelect,
  });

  return accounts.map(serializeManagedAccount);
}

export async function getCompanyAccount(companyId: string, accountId: string) {
  const account = await db.account.findFirst({
    where: { id: accountId, companyId },
    select: accountSelect,
  });

  if (!account) {
    return null;
  }

  return serializeManagedAccount(account);
}
