import type { EmployeePaymentType } from "@prisma/client";

export const EMPLOYEE_EXPENSE_CATEGORY = "Personel Giderleri";

export type EmployeePaymentTypeBehavior = {
  label: string;
  expenseCategory: string;
  requiresAccountToDisburse: boolean;
  allowPendingWithoutAccount: boolean;
  affectsPayableBalance: boolean;
  countsTowardPayrollAdvance: boolean;
  paidDirection: "PAID" | "DEDUCTED";
  buildTransactionTitle: (employeeName: string) => string;
  buildExpenseTitle: (employeeName: string) => string;
};

function buildEmployeePaymentExpenseTitle(employeeName: string) {
  return `Çalışan ödemesi: ${employeeName.trim()}`;
}

function buildEmployeePaymentTransactionTitle(employeeName: string) {
  return `Çalışan ödemesi: ${employeeName.trim()}`;
}

function buildEmployeeAdvanceTransactionTitle(employeeName: string) {
  return `Çalışan avansı: ${employeeName.trim()}`;
}

const DEFAULT_EXPENSE_TITLE = buildEmployeePaymentExpenseTitle;
const DEFAULT_TX_TITLE = buildEmployeePaymentTransactionTitle;

export const EMPLOYEE_PAYMENT_TYPE_BEHAVIOR: Record<
  EmployeePaymentType,
  EmployeePaymentTypeBehavior
> = {
  SALARY: {
    label: "Maaş",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: true,
    allowPendingWithoutAccount: true,
    affectsPayableBalance: true,
    countsTowardPayrollAdvance: false,
    paidDirection: "PAID",
    buildTransactionTitle: DEFAULT_TX_TITLE,
    buildExpenseTitle: DEFAULT_EXPENSE_TITLE,
  },
  ADVANCE: {
    label: "Çalışana Avans",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: true,
    allowPendingWithoutAccount: true,
    affectsPayableBalance: false,
    countsTowardPayrollAdvance: true,
    paidDirection: "PAID",
    buildTransactionTitle: buildEmployeeAdvanceTransactionTitle,
    buildExpenseTitle: (name) => `Çalışana avans: ${name.trim()}`,
  },
  BONUS: {
    label: "Prim",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: true,
    allowPendingWithoutAccount: false,
    affectsPayableBalance: true,
    countsTowardPayrollAdvance: false,
    paidDirection: "PAID",
    buildTransactionTitle: (name) => `Prim ödemesi: ${name.trim()}`,
    buildExpenseTitle: (name) => `Prim ödemesi: ${name.trim()}`,
  },
  DEDUCTION: {
    label: "Kesinti",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: false,
    allowPendingWithoutAccount: true,
    affectsPayableBalance: true,
    countsTowardPayrollAdvance: false,
    paidDirection: "DEDUCTED",
    buildTransactionTitle: (name) => `Çalışan kesintisi: ${name.trim()}`,
    buildExpenseTitle: (name) => `Çalışan kesintisi: ${name.trim()}`,
  },
  EXPENSE_REIMBURSEMENT: {
    label: "Masraf iadesi",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: true,
    allowPendingWithoutAccount: false,
    affectsPayableBalance: true,
    countsTowardPayrollAdvance: false,
    paidDirection: "PAID",
    buildTransactionTitle: (name) => `Masraf iadesi: ${name.trim()}`,
    buildExpenseTitle: (name) => `Masraf iadesi: ${name.trim()}`,
  },
  OTHER: {
    label: "Diğer",
    expenseCategory: EMPLOYEE_EXPENSE_CATEGORY,
    requiresAccountToDisburse: true,
    allowPendingWithoutAccount: true,
    affectsPayableBalance: true,
    countsTowardPayrollAdvance: false,
    paidDirection: "PAID",
    buildTransactionTitle: DEFAULT_TX_TITLE,
    buildExpenseTitle: DEFAULT_EXPENSE_TITLE,
  },
};

export function getEmployeePaymentTypeBehavior(type: EmployeePaymentType) {
  return EMPLOYEE_PAYMENT_TYPE_BEHAVIOR[type];
}

export function employeePaymentDisbursesCash(type: EmployeePaymentType) {
  return getEmployeePaymentTypeBehavior(type).requiresAccountToDisburse;
}

export function employeePaymentAllowsPendingWithoutAccount(
  type: EmployeePaymentType
) {
  return getEmployeePaymentTypeBehavior(type).allowPendingWithoutAccount;
}
