import { z } from "zod";

export const adminUserSuspendSchema = z.object({
  reason: z.string().min(3, "Askıya alma nedeni zorunludur.").max(500),
  suspendedUntil: z.string().datetime().optional(),
  internalNote: z.string().max(1000).optional(),
});

export const adminUserReactivateSchema = z.object({
  reason: z.string().min(3, "Yeniden etkinleştirme nedeni zorunludur.").max(500),
});

export const adminUserMembershipPatchSchema = z.object({
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
  role: z
    .enum(["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "POS_STAFF"])
    .optional(),
});

export const adminUserNoteSchema = z.object({
  content: z.string().min(1, "Not içeriği zorunludur.").max(2000),
  category: z
    .enum(["GENERAL", "BILLING", "SUPPORT", "RISK", "FRAUD", "TECHNICAL"])
    .default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
});

export const adminUserNotePatchSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  category: z
    .enum(["GENERAL", "BILLING", "SUPPORT", "RISK", "FRAUD", "TECHNICAL"])
    .optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  isPinned: z.boolean().optional(),
});

// Liste sorgu parametreleri
export const adminUserListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["ALL", "ACTIVE", "PASSIVE", "SUSPENDED"]).default("ALL"),
  platformRole: z.enum(["ALL", "SUPER_ADMIN", "USER"]).default("ALL"),
  loginStatus: z
    .enum(["ALL", "NEVER", "INACTIVE_30D", "ACTIVE_30D", "UNKNOWN"])
    .default("ALL"),
  companyCount: z.enum(["ALL", "ZERO", "ONE", "MULTI"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  sortBy: z
    .enum(["createdAt", "lastLoginAt", "name", "status"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
