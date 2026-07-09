import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  combineFinanceBreakdown,
  type FinanceAggregationBreakdown,
} from "@/lib/finance-aggregation-utils";
import {
  getCompanyAccountTransactions,
  getCompanyExpensesForFinance,
} from "@/lib/finance-aggregation-service";
import type { AccountTransactionLike } from "@/lib/cash-bank-account-utils";
import type { ExpenseForAggregation } from "@/lib/finance-aggregation-utils";
import {
  ACCRUAL_PROFIT_LABEL,
  CASH_RESULT_LABEL,
  CASH_RESULT_TOOLTIP,
} from "@/lib/finance/financial-period";

export const FINANCIAL_METRIC_VERSION = "cash-pl-v2";

export type FinancialBasis = "cash" | "accrual";

export type CanonicalFinancialSummary = {
  metricVersion: typeof FINANCIAL_METRIC_VERSION;
  period: { from: Date; to: Date; toExclusive?: Date };
  revenue: {
    basis: FinancialBasis;
    /** Tahsilat + manuel kasa girişi (transfer/ters kayıt hariç) */
    total: number;
    saleCollections: number;
    manualIncome: number;
    label: string;
  };
  expenses: {
    basis: FinancialBasis;
    /** Ödenen gider + manuel kasa çıkışı (transfer/ters kayıt hariç) */
    cashTotal: number;
    paidExpenseTotal: number;
    manualCashExpense: number;
    /** Aktif (iptal dışı) tüm gider tahakkuku */
    accruedTotal: number;
    unpaidAccrued: number;
    label: string;
  };
  adjustments: {
    /** Satış iptali / ters kayıt çıkışları — operasyonel gidere dahil değil */
    financeMirrorOutTotal: number;
    transferInTotal: number;
    transferOutTotal: number;
  };
  profit: {
    /**
     * Operasyonel nakit sonucu:
     * revenue.total - expenses.cashTotal
     */
    operational: number;
    /**
     * Nakit etkisi (ters kayıtlar düşülmüş):
     * revenue.total - expenses.cashTotal - financeMirrorOutTotal
     */
    cashNet: number;
    /**
     * Tahakkuk kârı (ayrı kart):
     * tahakkuk satış − tahakkuk gider
     * accrualSalesTotal verilmezse null.
     */
    accrual: number | null;
    label: string;
    tooltip: string;
    accrualLabel: string;
  };
  breakdown: FinanceAggregationBreakdown;
};

export function buildCanonicalFinancialSummary(
  accountTransactions: AccountTransactionLike[],
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date,
  options?: {
    toMode?: "inclusive" | "exclusive";
    /** Aktif satış tahakkuk toplamı (aynı dönem) — tahakkuk kârı için */
    accrualSalesTotal?: number;
  }
): CanonicalFinancialSummary {
  const breakdown = combineFinanceBreakdown(
    accountTransactions,
    expenses,
    from,
    to,
    { toMode: options?.toMode }
  );

  const revenueTotal = breakdown.totalIncome;
  const cashExpenseTotal = breakdown.totalExpense;
  const operational = roundCashMoney(revenueTotal - cashExpenseTotal);
  const cashNet = breakdown.netCashFlow;
  const accrual =
    options?.accrualSalesTotal === undefined
      ? null
      : roundCashMoney(
          options.accrualSalesTotal - breakdown.totalAccruedExpense
        );

  return {
    metricVersion: FINANCIAL_METRIC_VERSION,
    period: { from, to },
    revenue: {
      basis: "cash",
      total: revenueTotal,
      saleCollections: breakdown.saleCollectionIncome,
      manualIncome: breakdown.manualIncome,
      label: "Nakit Gelir",
    },
    expenses: {
      basis: "cash",
      cashTotal: cashExpenseTotal,
      paidExpenseTotal: breakdown.paidExpenseTotal,
      manualCashExpense: breakdown.manualCashExpense,
      accruedTotal: breakdown.totalAccruedExpense,
      unpaidAccrued: breakdown.recordedExpenseTotal,
      label: "Nakit Gider",
    },
    adjustments: {
      financeMirrorOutTotal: breakdown.financeMirrorOutTotal,
      transferInTotal: breakdown.transferInTotal,
      transferOutTotal: breakdown.transferOutTotal,
    },
    profit: {
      operational,
      cashNet,
      accrual,
      label: CASH_RESULT_LABEL,
      tooltip: CASH_RESULT_TOOLTIP,
      accrualLabel: ACCRUAL_PROFIT_LABEL,
    },
    breakdown,
  };
}

export async function getCanonicalFinancialSummary(
  companyId: string,
  from: Date,
  to: Date,
  options?: {
    toMode?: "inclusive" | "exclusive";
    accrualSalesTotal?: number;
  }
): Promise<CanonicalFinancialSummary> {
  const [transactions, expenses] = await Promise.all([
    getCompanyAccountTransactions(companyId),
    getCompanyExpensesForFinance(companyId),
  ]);

  return buildCanonicalFinancialSummary(
    transactions,
    expenses,
    from,
    to,
    options
  );
}
