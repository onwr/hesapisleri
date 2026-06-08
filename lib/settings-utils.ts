import { z } from "zod";
import type { InvoiceType, UserRole } from "@prisma/client";

export const DEFAULT_COMPANY_SETTINGS = {
  currency: "TRY",
  defaultVatRate: 20,
  defaultInvoiceType: "E_ARCHIVE" as InvoiceType,
  invoiceNumberPrefix: "FTR",
  defaultDueDays: 30,
  invoiceNoteTemplate: "",
  defaultCollectionAccountId: null as string | null,
  defaultExpenseAccountId: null as string | null,
  autoCreateCashAccount: true,
  hideInactiveAccounts: true,
  notifyLowStock: true,
  notifyDueInvoices: true,
  notifyLateCollections: true,
  notifyDailySummary: false,
};

export const updateCompanySettingsSchema = z.object({
  name: z.string().min(2, "Firma adı zorunludur."),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Geçerli bir e-posta girin.")
    .optional()
    .or(z.literal("")),
  taxNo: z.string().optional(),
  taxOffice: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
  currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
  defaultVatRate: z.number().int().min(0).max(100).default(20),
});

export const updateInvoiceSettingsSchema = z.object({
  defaultInvoiceType: z.enum(["E_INVOICE", "E_ARCHIVE", "NORMAL"]).default(
    "E_ARCHIVE"
  ),
  invoiceNumberPrefix: z
    .string()
    .min(1, "Fatura ön eki zorunludur.")
    .max(12, "Ön ek en fazla 12 karakter olabilir."),
  defaultDueDays: z.number().int().min(0).max(365).default(30),
  defaultVatRate: z.number().int().min(0).max(100).default(20),
  invoiceNoteTemplate: z.string().max(2000).optional(),
});

export const updateCashBankSettingsSchema = z.object({
  defaultCollectionAccountId: z.string().optional().nullable(),
  defaultExpenseAccountId: z.string().optional().nullable(),
  autoCreateCashAccount: z.boolean().default(true),
  hideInactiveAccounts: z.boolean().default(true),
});

export const updateNotificationSettingsSchema = z.object({
  notifyLowStock: z.boolean().default(true),
  notifyDueInvoices: z.boolean().default(true),
  notifyLateCollections: z.boolean().default(true),
  notifyDailySummary: z.boolean().default(false),
});

export type UpdateCompanySettingsInput = z.infer<
  typeof updateCompanySettingsSchema
>;
export type UpdateInvoiceSettingsInput = z.infer<
  typeof updateInvoiceSettingsSchema
>;
export type UpdateCashBankSettingsInput = z.infer<
  typeof updateCashBankSettingsSchema
>;
export type UpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  ACCOUNTANT: "Muhasebeci",
  STAFF: "Personel",
  SUPER_ADMIN: "Süper Admin",
};

export function getUserRoleLabel(role: UserRole) {
  return ROLE_LABELS[role] ?? role;
}

export function getInvoiceTypeLabel(type: InvoiceType) {
  if (type === "E_INVOICE") return "e-Fatura";
  if (type === "E_ARCHIVE") return "e-Arşiv";
  return "Normal Fatura";
}

export function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function validateAccountBelongsToCompany(
  account: { id: string; companyId: string } | null,
  companyId: string
) {
  if (!account) {
    return { ok: false as const, message: "Seçilen hesap bulunamadı." };
  }

  if (account.companyId !== companyId) {
    return {
      ok: false as const,
      message: "Bu hesaba erişim yetkiniz yok.",
    };
  }

  return { ok: true as const };
}
