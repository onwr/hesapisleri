import { db } from "@/lib/prisma";
import {
  COLLECTION_ACCOUNT_TYPES,
  isCollectionEligibleAccountType,
} from "@/lib/collection-account-utils";
import {
  FINANCE_OUTFLOW_ACCOUNT_TYPES,
  isFinanceOutflowEligibleAccount,
} from "@/lib/finance-account-utils";
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

const financeAccountOptionSelect = {
  id: true,
  name: true,
  type: true,
  balance: true,
  currency: true,
  isDefault: true,
} as const;

const collectionAccountOptionSelect = {
  ...financeAccountOptionSelect,
  bankName: true,
  iban: true,
} as const;

export async function getFinanceAccountOptions(companyId: string) {
  const accounts = await db.account.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      type: { in: [...FINANCE_OUTFLOW_ACCOUNT_TYPES] },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: financeAccountOptionSelect,
  });

  return accounts
    .filter((account) => isFinanceOutflowEligibleAccount(account))
    .map(serializeAccountOption);
}

export async function getCollectionAccountOptions(companyId: string) {
  const accounts = await db.account.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      type: { in: [...COLLECTION_ACCOUNT_TYPES] },
    },
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    select: collectionAccountOptionSelect,
  });

  return accounts
    .filter((account) => isCollectionEligibleAccountType(account.type))
    .map((account) => ({
      ...serializeAccountOption(account),
      bankName: account.bankName,
      iban: account.iban,
    }));
}

export async function getActiveAccountOptions(companyId: string) {
  const accounts = await db.account.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { type: "asc" }, { name: "asc" }],
    select: financeAccountOptionSelect,
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
