/**
 * Ortak işlem yaşam döngüsü politikası — modül bazlı aksiyon matrisi.
 * Hard delete yerine iptal/ters kayıt tercih edilir.
 */

export type TransactionLifecycleState =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "POSTED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED"
  | "OVERDUE";

export type TransactionLifecycleAction =
  | "view"
  | "edit"
  | "delete"
  | "cancel"
  | "reverse"
  | "archive"
  | "restore";

export type TransactionModuleKey =
  | "sales"
  | "invoices"
  | "e_invoices"
  | "collections"
  | "payments"
  | "expenses"
  | "cash_bank"
  | "account_transfers"
  | "orders"
  | "products"
  | "stock_movements"
  | "stock_transfers"
  | "customers"
  | "suppliers"
  | "employee_payments"
  | "payroll"
  | "leaves";

export type LifecycleActionMatrix = Record<
  TransactionLifecycleAction,
  boolean
>;

const NO_ACTIONS: LifecycleActionMatrix = {
  view: true,
  edit: false,
  delete: false,
  cancel: false,
  reverse: false,
  archive: false,
  restore: false,
};

function matrix(
  overrides: Partial<LifecycleActionMatrix>
): LifecycleActionMatrix {
  return { ...NO_ACTIONS, ...overrides };
}

/** Kesinleşmiş finansal/stok etkili kayıtlar hard delete edilemez. */
export function isFinanciallyFinalizedState(
  state: TransactionLifecycleState
): boolean {
  return (
    state === "APPROVED" ||
    state === "PAID" ||
    state === "POSTED" ||
    state === "COMPLETED"
  );
}

export function canHardDeleteByLifecycleState(
  state: TransactionLifecycleState
): boolean {
  return state === "DRAFT";
}

export function canEditByLifecycleState(
  state: TransactionLifecycleState
): boolean {
  return state === "DRAFT" || state === "PENDING" || state === "OVERDUE";
}

export function canCancelByLifecycleState(
  state: TransactionLifecycleState
): boolean {
  if (state === "CANCELLED" || state === "ARCHIVED") return false;
  return (
    state === "PENDING" ||
    state === "OVERDUE" ||
    isFinanciallyFinalizedState(state)
  );
}

export function requiresCancelReason(
  state: TransactionLifecycleState
): boolean {
  return isFinanciallyFinalizedState(state);
}

/** Modül + durum için desteklenen aksiyonlar (mevcut kod davranışına uyumlu). */
export function resolveModuleLifecycleActions(input: {
  module: TransactionModuleKey;
  state: TransactionLifecycleState;
}): LifecycleActionMatrix {
  const { module, state } = input;

  if (state === "ARCHIVED") {
    return matrix({ restore: true });
  }

  if (state === "CANCELLED") {
    return matrix({ view: true });
  }

  switch (module) {
    case "employee_payments":
      if (state === "DRAFT" || state === "PENDING" || state === "OVERDUE") {
        return matrix({ edit: true, delete: true, cancel: true });
      }
      if (state === "PAID") {
        return matrix({ cancel: true, reverse: true });
      }
      return NO_ACTIONS;

    case "expenses":
      if (state === "DRAFT" || state === "PENDING") {
        return matrix({ edit: true, delete: true, cancel: true });
      }
      if (state === "APPROVED" || state === "PAID") {
        return matrix({ cancel: true, reverse: true });
      }
      return NO_ACTIONS;

    case "sales":
    case "invoices":
      if (state === "DRAFT") {
        return matrix({ edit: true, delete: true });
      }
      if (state === "COMPLETED" || state === "POSTED" || state === "PAID") {
        return matrix({ cancel: true, reverse: true });
      }
      return matrix({ edit: state === "PENDING", cancel: state === "PENDING" });

    case "e_invoices":
      if (state === "DRAFT") {
        return matrix({ edit: true, delete: true });
      }
      if (isFinanciallyFinalizedState(state) || state === "COMPLETED") {
        return matrix({ cancel: true });
      }
      return NO_ACTIONS;

    case "stock_movements":
      return matrix({ view: true });

    case "account_transfers":
      if (state === "DRAFT" || state === "PENDING") {
        return matrix({ edit: true, cancel: true });
      }
      if (isFinanciallyFinalizedState(state) || state === "COMPLETED") {
        return matrix({ cancel: true, reverse: true });
      }
      return NO_ACTIONS;

    case "payroll":
      if (state === "DRAFT") {
        return matrix({ edit: true, delete: true, cancel: true });
      }
      if (state === "APPROVED" || state === "PENDING") {
        return matrix({ edit: true, cancel: true });
      }
      if (state === "PAID") {
        return matrix({ cancel: false });
      }
      return NO_ACTIONS;

    case "cash_bank":
      if (state === "DRAFT") {
        return matrix({ edit: true, delete: true });
      }
      if (isFinanciallyFinalizedState(state) || state === "COMPLETED") {
        return matrix({ cancel: true, reverse: true });
      }
      return matrix({ edit: state === "PENDING" });

    default:
      if (state === "DRAFT") {
        return matrix({ edit: true, delete: true });
      }
      if (state === "PENDING") {
        return matrix({ edit: true, cancel: true });
      }
      if (isFinanciallyFinalizedState(state) || state === "COMPLETED") {
        return matrix({ cancel: true, reverse: true });
      }
      return NO_ACTIONS;
  }
}

export function mapEmployeePaymentStatusToLifecycle(
  status: string
): TransactionLifecycleState {
  if (status === "PENDING") return "PENDING";
  if (status === "OVERDUE") return "OVERDUE";
  if (status === "PAID") return "PAID";
  if (status === "CANCELLED") return "CANCELLED";
  return "PENDING";
}

export function buildLifecycleAuditMetadata(input: {
  reason?: string;
  changedFields?: Record<string, { from: unknown; to: unknown }>;
}) {
  const metadata: Record<string, unknown> = {};
  if (input.reason?.trim()) {
    metadata.reason = input.reason.trim();
  }
  if (input.changedFields && Object.keys(input.changedFields).length > 0) {
    metadata.changedFields = input.changedFields;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
