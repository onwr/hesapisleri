import type {
  EmployeePayment,
  PayrollRunItemStatus,
  PayrollRunStatus,
} from "@prisma/client";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export const PAYROLL_RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  DRAFT: "Taslak",
  APPROVED: "Onaylandı",
  PAID: "Ödendi",
  CANCELLED: "İptal",
};

export const PAYROLL_ITEM_STATUS_LABELS: Record<PayrollRunItemStatus, string> = {
  DRAFT: "Taslak",
  APPROVED: "Onaylandı",
  PAID: "Ödendi",
  CANCELLED: "İptal",
};

export type PayrollItemInput = {
  baseSalary: number;
  bonusAmount?: number;
  deductionAmount?: number;
  advanceDeduction?: number;
};

export type PayrollTotals = {
  grossTotal: number;
  bonusTotal: number;
  deductionTotal: number;
  netTotal: number;
  employeeCount: number;
};

export function calculatePayrollItemNetPayable(input: PayrollItemInput) {
  const baseSalary = roundCashMoney(input.baseSalary);
  const bonusAmount = roundCashMoney(input.bonusAmount ?? 0);
  const deductionAmount = roundCashMoney(input.deductionAmount ?? 0);
  const advanceDeduction = roundCashMoney(input.advanceDeduction ?? 0);

  return roundCashMoney(
    baseSalary + bonusAmount - deductionAmount - advanceDeduction
  );
}

export function calculatePayrollRunTotals(
  items: Array<{
    baseSalary: number;
    bonusAmount: number;
    deductionAmount: number;
    advanceDeduction: number;
    netPayable: number;
  }>
): PayrollTotals {
  let grossTotal = 0;
  let bonusTotal = 0;
  let deductionTotal = 0;
  let netTotal = 0;

  for (const item of items) {
    grossTotal = roundCashMoney(grossTotal + item.baseSalary);
    bonusTotal = roundCashMoney(bonusTotal + item.bonusAmount);
    deductionTotal = roundCashMoney(
      deductionTotal + item.deductionAmount + item.advanceDeduction
    );
    netTotal = roundCashMoney(netTotal + item.netPayable);
  }

  return {
    grossTotal,
    bonusTotal,
    deductionTotal,
    netTotal,
    employeeCount: items.length,
  };
}

export function normalizePayrollPeriod(input: {
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);

  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { ok: false as const, message: "Geçerli bir dönem tarihi girin." };
  }

  if (periodEnd < periodStart) {
    return {
      ok: false as const,
      message: "Dönem bitiş tarihi başlangıçtan önce olamaz.",
    };
  }

  return { ok: true as const, periodStart, periodEnd };
}

export function buildDefaultPayrollTitle(periodStart: Date, periodEnd: Date) {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  });
  const startLabel = formatter.format(periodStart);
  const endLabel = formatter.format(periodEnd);

  if (startLabel === endLabel) {
    return `${startLabel} Bordrosu`;
  }

  return `${startLabel} – ${endLabel} Bordrosu`;
}

export function formatPayrollPeriodLabel(periodStart: Date, periodEnd: Date) {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(periodStart)} – ${formatter.format(periodEnd)}`;
}

export function buildPayrollPaymentDescription(
  periodStart: Date,
  periodEnd: Date
) {
  return `${formatPayrollPeriodLabel(periodStart, periodEnd)} maaş ödemesi`;
}

export function getPaymentEffectiveDate(payment: Pick<EmployeePayment, "dueDate" | "createdAt">) {
  return payment.dueDate ?? payment.createdAt;
}

export function isPaymentInPayrollPeriod(
  payment: Pick<EmployeePayment, "dueDate" | "createdAt" | "status" | "type">,
  periodStart: Date,
  periodEnd: Date
) {
  if (payment.status !== "PENDING" && payment.status !== "OVERDUE") {
    return false;
  }

  const effectiveDate = getPaymentEffectiveDate(payment);
  return effectiveDate >= periodStart && effectiveDate <= periodEnd;
}

export function sumPaymentsByType(
  payments: Pick<EmployeePayment, "type" | "amount" | "dueDate" | "createdAt" | "status">[],
  type: EmployeePayment["type"],
  periodStart: Date,
  periodEnd: Date
) {
  return roundCashMoney(
    payments
      .filter(
        (payment) =>
          payment.type === type &&
          isPaymentInPayrollPeriod(payment, periodStart, periodEnd)
      )
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  );
}

export function validatePayrollRunStatusTransition(
  current: PayrollRunStatus,
  next: PayrollRunStatus
) {
  const allowed: Record<PayrollRunStatus, PayrollRunStatus[]> = {
    DRAFT: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  return allowed[current].includes(next);
}

export function canApprovePayrollRun(status: PayrollRunStatus) {
  return status === "DRAFT";
}

export function canRecalculatePayrollRun(status: PayrollRunStatus) {
  return status === "DRAFT";
}

export function canGeneratePayrollPayments(status: PayrollRunStatus) {
  return status === "APPROVED";
}

export function canMarkPayrollRunPaid(status: PayrollRunStatus) {
  return status === "APPROVED";
}

export function canCancelPayrollRun(status: PayrollRunStatus) {
  return status === "DRAFT" || status === "APPROVED";
}

export function getPayrollRunStatusBadgeClass(status: PayrollRunStatus) {
  const map: Record<PayrollRunStatus, string> = {
    DRAFT: "bg-amber-50 text-amber-700 ring-amber-100",
    APPROVED: "bg-blue-50 text-blue-700 ring-blue-100",
    PAID: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return map[status];
}

export function getPayrollItemStatusBadgeClass(status: PayrollRunItemStatus) {
  return getPayrollRunStatusBadgeClass(status as PayrollRunStatus);
}

export function buildPayrollRunActionUrl(payrollRunId: string) {
  return `/team/payroll/${payrollRunId}`;
}

export function isDuplicatePayrollPeriodConflict(existing: {
  id: string;
  status: PayrollRunStatus;
}) {
  return existing.status !== "CANCELLED";
}

export function getPayrollRunActions(status: PayrollRunStatus) {
  return {
    canEditItems: canEditPayrollRunItems(status),
    canRecalculate: canRecalculatePayrollRun(status),
    canApprove: canApprovePayrollRun(status),
    canGeneratePayments: canGeneratePayrollPayments(status),
    canMarkPaid: canMarkPayrollRunPaid(status),
    canCancel: canCancelPayrollRun(status),
  };
}

export function canEditPayrollRunItems(status: PayrollRunStatus) {
  return status === "DRAFT";
}

export type PayrollItemUpdateInput = {
  bonusAmount?: number;
  deductionAmount?: number;
  advanceDeduction?: number;
  notes?: string | null;
};

export function validatePayrollItemUpdateInput(input: PayrollItemUpdateInput) {
  const fields: Array<keyof Pick<
    PayrollItemUpdateInput,
    "bonusAmount" | "deductionAmount" | "advanceDeduction"
  >> = ["bonusAmount", "deductionAmount", "advanceDeduction"];

  for (const field of fields) {
    if (input[field] === undefined) continue;
    const value = input[field]!;
    if (!Number.isFinite(value) || value < 0) {
      return {
        ok: false as const,
        message: "Prim, kesinti ve avans değerleri negatif olamaz.",
      };
    }
  }

  return { ok: true as const };
}

export function validatePayrollItemNetPayable(netPayable: number) {
  if (netPayable < 0) {
    return {
      ok: false as const,
      message: "Net ödenecek tutar negatif olamaz.",
    };
  }

  if (netPayable === 0) {
    return {
      ok: true as const,
      warning:
        "Net ödenecek tutar sıfır. Bu kalem için ödeme kaydı oluşturulmayabilir.",
    };
  }

  return { ok: true as const };
}

export function buildPayrollItemUpdatePayload(input: {
  baseSalary: number;
  current: {
    bonusAmount: number;
    deductionAmount: number;
    advanceDeduction: number;
    notes: string | null;
  };
  update: PayrollItemUpdateInput;
}) {
  const bonusAmount = roundCashMoney(
    input.update.bonusAmount ?? input.current.bonusAmount
  );
  const deductionAmount = roundCashMoney(
    input.update.deductionAmount ?? input.current.deductionAmount
  );
  const advanceDeduction = roundCashMoney(
    input.update.advanceDeduction ?? input.current.advanceDeduction
  );
  const netPayable = calculatePayrollItemNetPayable({
    baseSalary: input.baseSalary,
    bonusAmount,
    deductionAmount,
    advanceDeduction,
  });

  return {
    bonusAmount,
    deductionAmount,
    advanceDeduction,
    netPayable,
    notes:
      input.update.notes !== undefined
        ? input.update.notes?.trim() || null
        : input.current.notes,
  };
}
