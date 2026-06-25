import type { EmployeePaymentStatus } from "@prisma/client";

export const EMPLOYEE_EXPENSE_CATEGORY = "Personel Giderleri";

export type MarkPaymentPaidFinanceResult = {
  expenseCreated: boolean;
  transactionCreated: boolean;
  relatedExpenseId: string | null;
  relatedTransactionId: string | null;
};

export type EmployeePaymentFinancePlan = {
  isAlreadyPaid: boolean;
  createExpense: boolean;
  createTransaction: boolean;
  accountId: string | null;
};

export function buildEmployeePaymentExpenseTitle(employeeName: string) {
  return `Çalışan ödemesi: ${employeeName.trim()}`;
}

export function buildEmployeePaymentTransactionTitle(employeeName: string) {
  return `Çalışan ödemesi: ${employeeName.trim()}`;
}

export function buildEmployeeAdvanceTransactionTitle(employeeName: string) {
  return `Çalışan avansı: ${employeeName.trim()}`;
}

export function buildEmployeePaymentsActionUrl(employeeId: string) {
  return `/team/${employeeId}?tab=payments`;
}

export function buildEmployeePaymentExpenseHref(expenseId: string) {
  return `/expenses/${expenseId}`;
}

export function buildEmployeePaymentTransactionHref(input: {
  transactionId: string;
  accountId?: string | null;
}) {
  if (input.accountId) {
    return `/cash-bank/${input.accountId}`;
  }

  return "/cash-bank";
}

export const EMPLOYEE_PAYMENT_FINANCE_BADGE_CLASS = {
  expense:
    "inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700 ring-1 ring-inset ring-violet-200 transition hover:bg-violet-100 hover:ring-violet-300",
  transaction:
    "inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700 ring-1 ring-inset ring-sky-200 transition hover:bg-sky-100 hover:ring-sky-300",
} as const;

export function resolveEmployeePaymentFinancePlan(input: {
  status: EmployeePaymentStatus;
  relatedExpenseId?: string | null;
  relatedTransactionId?: string | null;
  relatedAccountId?: string | null;
}): EmployeePaymentFinancePlan {
  const accountId = input.relatedAccountId?.trim() || null;

  if (input.status === "PAID") {
    return {
      isAlreadyPaid: true,
      createExpense: false,
      createTransaction: false,
      accountId,
    };
  }

  return {
    isAlreadyPaid: false,
    createExpense: !input.relatedExpenseId,
    createTransaction: !input.relatedTransactionId && Boolean(accountId),
    accountId,
  };
}

export function buildMarkPaymentPaidFinanceResult(input: {
  expenseCreated: boolean;
  transactionCreated: boolean;
  relatedExpenseId: string | null;
  relatedTransactionId: string | null;
}): MarkPaymentPaidFinanceResult {
  return {
    expenseCreated: input.expenseCreated,
    transactionCreated: input.transactionCreated,
    relatedExpenseId: input.relatedExpenseId,
    relatedTransactionId: input.relatedTransactionId,
  };
}

export function validateMarkEmployeePaymentPaidInput(input: {
  status?: string;
  relatedAccountId?: string | null;
  requireAccount?: boolean;
}):
  | { ok: true }
  | { ok: false; message: string; status: number } {
  const needsAccount =
    input.requireAccount === true || input.status === "PAID";

  if (needsAccount && !input.relatedAccountId?.trim()) {
    return {
      ok: false,
      message: "Ödeme hesabı seçilmelidir.",
      status: 400,
    };
  }

  return { ok: true };
}

export function validateEmployeePaymentMarkPaidForm(input: {
  relatedAccountId: string;
}): string | null {
  if (!input.relatedAccountId.trim()) {
    return "Ödeme hesabı seçilmelidir.";
  }

  return null;
}

export function shouldShowMarkPaidButton(status: EmployeePaymentStatus) {
  return status === "PENDING" || status === "OVERDUE";
}

export function buildMarkPaymentPaidApiResponse(input: {
  payment: unknown;
  finance: MarkPaymentPaidFinanceResult;
}) {
  return {
    success: true as const,
    payment: input.payment,
    finance: input.finance,
  };
}
