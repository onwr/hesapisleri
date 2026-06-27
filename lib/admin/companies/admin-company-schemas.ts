import { z } from "zod";

export const ADMIN_COMPANY_PAGE_SIZES = [25, 50, 100] as const;

export const adminCompanyListSortSchema = z.enum([
  "newest",
  "oldest",
  "name",
  "last_activity",
  "subscription_end",
  "last_payment",
  "user_count",
]);

export const suspendCompanySchema = z.object({
  reason: z.string().min(3, "Neden en az 3 karakter olmalıdır."),
  internalNote: z.string().min(3, "İç not en az 3 karakter olmalıdır."),
  suspendedUntil: z.string().datetime().optional().nullable(),
});

export const reactivateCompanySchema = z.object({
  reason: z.string().min(3, "Neden en az 3 karakter olmalıdır."),
});

export const extendCompanyTrialSchema = z.object({
  mode: z.enum(["PLUS_3", "PLUS_7", "PLUS_14", "CUSTOM"]),
  days: z.number().int().min(1).max(90).optional(),
  customDate: z.string().datetime().optional(),
  reason: z.string().min(3, "Neden en az 3 karakter olmalıdır."),
  notifyOwner: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
});

export const archiveCompanySchema = z.object({
  reason: z.string().min(3, "Neden en az 3 karakter olmalıdır."),
  confirmName: z.string().min(1),
});

export const adminCompanyNoteSchema = z.object({
  content: z.string().min(2, "Not en az 2 karakter olmalıdır."),
  category: z.enum([
    "GENERAL",
    "BILLING",
    "SUPPORT",
    "RISK",
    "SALES",
    "TECHNICAL",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().optional(),
});

export const adminCompanyNotePatchSchema = adminCompanyNoteSchema.partial();

export const deactivateCompanyUserSchema = z.object({
  companyUserId: z.string().min(1),
  reason: z.string().min(3, "Neden en az 3 karakter olmalıdır."),
});

export const reactivateCompanyUserSchema = z.object({
  companyUserId: z.string().min(1),
  reason: z.string().min(3).optional(),
});
