import { z } from "zod";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export const EXPENSE_PAYMENT_STATUSES = ["PAID", "UNPAID"] as const;
export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Kira",
  "Elektrik",
  "Su",
  "Doğalgaz",
  "İnternet",
  "Telefon",
  "Ofis",
  "Ulaşım",
  "Yemek",
  "Reklam",
  "Danışmanlık",
  "Bakım",
  "Sigorta",
  "Vergi",
  "Diğer",
];

export const createExpenseSchema = z
  .object({
    title: z.string().trim().min(2, "Gider başlığı en az 2 karakter olmalıdır."),
    category: z.string().optional(),
    supplier: z.string().optional(),
    amount: z.number().positive("Gider tutarı 0'dan büyük olmalıdır."),
    date: z.string().optional(),
    note: z.string().optional(),
    paymentStatus: z.enum(EXPENSE_PAYMENT_STATUSES),
    accountId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === "PAID" && !data.accountId?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Ödenmiş gider için ödeme hesabı seçilmelidir.",
        path: ["accountId"],
      });
    }
  });

export const updateExpenseSchema = z.object({
  title: z.string().trim().min(2, "Gider başlığı en az 2 karakter olmalıdır."),
  category: z.string().optional(),
  supplier: z.string().optional(),
  amount: z.number().positive("Gider tutarı 0'dan büyük olmalıdır.").optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const payExpenseSchema = z.object({
  accountId: z.string().trim().min(1, "Ödeme hesabı seçilmelidir."),
  paidAt: z.string().optional(),
  note: z.string().optional(),
});

export type PayExpenseInput = z.infer<typeof payExpenseSchema>;

export function normalizeExpenseCategory(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || "Diğer";
}

export function parseExpenseDate(value?: string | null) {
  if (!value?.trim()) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function buildExpenseTransactionTitle(title: string) {
  return `Gider - ${title.trim()}`;
}

export function buildExpensePaymentTransactionTitle(title: string) {
  return `Gider Ödemesi - ${title.trim()}`;
}

export function getPaymentStatusBadge(paymentStatus: string) {
  if (paymentStatus === "PAID") {
    return {
      label: "Ödendi",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Ödenmedi",
    className: "bg-orange-50 text-orange-700",
  };
}

export function getPaymentStatusLabel(paymentStatus: string) {
  return paymentStatus === "PAID" ? "Ödendi" : "Ödenmedi";
}

export function getExpenseDisplayPaymentBadge(expense: {
  paymentStatus: string;
  status: string;
}) {
  if (isCancelledExpense(expense.status)) {
    return {
      label: "İptal",
      className: "bg-slate-100 text-slate-600",
    };
  }

  return getPaymentStatusBadge(expense.paymentStatus);
}

export function validateExpenseAmountUpdate(
  expense: {
    paymentStatus: string;
    status: string;
  },
  newAmount?: number
) {
  if (isCancelledExpense(expense.status)) {
    return {
      ok: false as const,
      message: "İptal edilmiş gider düzenlenemez.",
    };
  }

  if (newAmount === undefined) {
    return { ok: true as const };
  }

  if (expense.paymentStatus === "PAID") {
    return {
      ok: false as const,
      message: "Ödenmiş giderde tutar değiştirilemez.",
    };
  }

  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return {
      ok: false as const,
      message: "Geçerli bir tutar girin.",
    };
  }

  return { ok: true as const };
}

export function canEditExpenseAmountOrAccount(expense: {
  paymentStatus: string;
  status: string;
}) {
  return expense.status !== "CANCELLED" && expense.paymentStatus !== "PAID";
}

export function mergeExpenseCategories(
  existing: string[],
  defaults: string[] = DEFAULT_EXPENSE_CATEGORIES
) {
  return Array.from(
    new Set(
      [...defaults, ...existing.map((item) => normalizeExpenseCategory(item))].filter(
        Boolean
      )
    )
  ).sort((a, b) => a.localeCompare(b, "tr-TR"));
}

export function calculateExpenseBalanceChange(
  paymentStatus: ExpensePaymentStatus,
  amount: number,
  direction: "charge" | "refund"
) {
  const normalized = roundCashMoney(amount);
  if (paymentStatus !== "PAID") {
    return 0;
  }

  return direction === "charge" ? -normalized : normalized;
}

export function isCancelledExpense(status: string) {
  return status === "CANCELLED";
}

export function isActiveExpenseRecord(expense: {
  status?: string | null;
}) {
  return expense.status !== "CANCELLED";
}

export function isPaidExpense(expense: {
  paymentStatus?: string | null;
}) {
  return expense.paymentStatus === "PAID";
}

export function isUnpaidExpense(expense: {
  paymentStatus?: string | null;
}) {
  return expense.paymentStatus !== "PAID";
}

export function validateExpensePayEligibility(expense: {
  paymentStatus: string;
  status: string;
  accountTransaction?: unknown | null;
}) {
  if (isCancelledExpense(expense.status)) {
    return {
      ok: false as const,
      message: "İptal edilmiş gider ödenemez.",
    };
  }

  if (expense.paymentStatus === "PAID") {
    return {
      ok: false as const,
      message: "Gider zaten ödenmiş.",
    };
  }

  if (expense.accountTransaction) {
    return {
      ok: false as const,
      message: "Gider için zaten kasa hareketi mevcut.",
    };
  }

  return { ok: true as const };
}
