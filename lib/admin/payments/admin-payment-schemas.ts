import { z } from "zod";

export const adminPaymentListQuerySchema = z.object({
  q: z.string().optional(),
  status: z
    .enum([
      "ALL",
      "PAID",
      "PENDING",
      "WAIT_CALLBACK",
      "FAILED",
      "CANCELLED",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
      "UNKNOWN",
    ])
    .default("ALL"),
  provider: z.enum(["ALL", "PAYTR", "MANUAL", "LEGACY", "TRIAL_PLACEHOLDER"]).default("ALL"),
  currency: z.enum(["ALL", "TRY", "USD", "EUR"]).default("ALL"),
  dateRange: z
    .enum(["ALL", "TODAY", "LAST_24H", "LAST_7D", "LAST_30D", "THIS_MONTH", "LAST_MONTH", "CUSTOM"])
    .default("ALL"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  refund: z.enum(["ALL", "NONE", "PARTIAL", "FULL", "PENDING", "FAILED"]).default("ALL"),
  callback: z
    .enum(["ALL", "RECEIVED", "WAITING", "VERIFIED", "VERIFY_FAILED", "MISSING"])
    .default("ALL"),
  subscription: z
    .enum(["ALL", "LINKED", "UNLINKED", "ACTIVE_SUB", "CANCELLED_SUB", "SUB_NOT_FOUND"])
    .default("ALL"),
  issue: z.string().optional(),
  sortBy: z
    .enum([
      "createdAt",
      "amount",
      "companyName",
      "status",
      "callbackReceivedAt",
      "paidAt",
      "refundedAmountMinor",
    ])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(25).max(100).default(25),
  // Legacy deep-link params
  companyId: z.string().optional(),
  paymentId: z.string().optional(),
  subscriptionId: z.string().optional(),
  merchantOid: z.string().optional(),
});

export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;

export const adminPaymentNoteCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  category: z
    .enum(["GENERAL", "PAYMENT", "CALLBACK", "REFUND", "BILLING", "RISK", "SUPPORT", "TECHNICAL"])
    .default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
});

export const adminPaymentNoteUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  category: z
    .enum(["GENERAL", "PAYMENT", "CALLBACK", "REFUND", "BILLING", "RISK", "SUPPORT", "TECHNICAL"])
    .optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  isPinned: z.boolean().optional(),
});

export const syncPaymentProviderSchema = z.object({
  force: z.boolean().default(false),
});

export type AdminPaymentTab =
  | "overview"
  | "provider"
  | "subscription"
  | "refunds"
  | "events"
  | "activity"
  | "notes";

export function resolvePaymentTab(raw: string | undefined): AdminPaymentTab {
  const tabs: AdminPaymentTab[] = [
    "overview",
    "provider",
    "subscription",
    "refunds",
    "events",
    "activity",
    "notes",
  ];
  if (raw && (tabs as string[]).includes(raw)) return raw as AdminPaymentTab;
  return "overview";
}
