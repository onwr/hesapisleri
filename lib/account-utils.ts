import { z } from "zod";

export const ACCOUNT_TYPES = [
  "CASH",
  "BANK",
  "CREDIT_CARD",
  "POS",
  "OTHER",
] as const;

export type ManagedAccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Kasa",
  BANK: "Banka",
  CREDIT_CARD: "Kredi Kartı",
  POS: "POS Hesabı",
  OTHER: "Diğer",
  STATIC: "Diğer",
};

export const CASH_LIKE_ACCOUNT_TYPES = new Set(["CASH", "POS"]);
export const BANK_LIKE_ACCOUNT_TYPES = new Set([
  "BANK",
  "CREDIT_CARD",
  "OTHER",
  "STATIC",
]);

export function getAccountTypeLabel(type: string) {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

export function isCashLikeAccountType(type: string) {
  return CASH_LIKE_ACCOUNT_TYPES.has(type);
}

export function isBankLikeAccountType(type: string) {
  return BANK_LIKE_ACCOUNT_TYPES.has(type);
}

export function accountShowsBankFields(type: string) {
  return type === "BANK" || type === "CREDIT_CARD" || type === "OTHER";
}

const accountTypeSchema = z.enum(ACCOUNT_TYPES);

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Hesap adı zorunludur."),
  type: accountTypeSchema,
  bankName: z.string().trim().optional().nullable(),
  branchName: z.string().trim().optional().nullable(),
  iban: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  currency: z.string().trim().min(1).default("TRY"),
  openingBalance: z.number().finite().default(0),
  isDefault: z.boolean().optional().default(false),
  description: z.string().trim().optional().nullable(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Hesap adı zorunludur.").optional(),
  type: accountTypeSchema.optional(),
  bankName: z.string().trim().optional().nullable(),
  branchName: z.string().trim().optional().nullable(),
  iban: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  currency: z.string().trim().min(1).optional(),
  isDefault: z.boolean().optional(),
  description: z.string().trim().optional().nullable(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export type SerializedAccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDefault: boolean;
};

export type SerializedManagedAccount = SerializedAccountOption & {
  bankName: string | null;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeAccountOption(account: {
  id: string;
  name: string;
  type: string;
  balance: unknown;
  currency: string;
  isDefault: boolean;
}): SerializedAccountOption {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: Number(account.balance),
    currency: account.currency,
    isDefault: account.isDefault,
  };
}

export function serializeManagedAccount(account: {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  balance: unknown;
  currency: string;
  isDefault: boolean;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): SerializedManagedAccount {
  return {
    ...serializeAccountOption(account),
    bankName: account.bankName,
    branchName: account.branchName,
    iban: account.iban,
    accountNumber: account.accountNumber,
    description: account.description,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
