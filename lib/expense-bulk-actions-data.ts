import { getActiveExpenseCategoryNames } from "@/lib/expense-category-service";
import {
  getBulkExpenseList,
  parseBulkExpenseFilters,
  type ExpenseBulkFilters,
} from "@/lib/expense-bulk-actions-service";
import { getExpenseFormAccounts } from "@/lib/expense-service";

export { parseBulkExpenseFilters };

export async function getExpenseBulkActionsPageData(
  companyId: string,
  filters: ExpenseBulkFilters
) {
  const [listData, categories, accounts] = await Promise.all([
    getBulkExpenseList(companyId, filters),
    getActiveExpenseCategoryNames(companyId),
    getExpenseFormAccounts(companyId),
  ]);

  return {
    categories,
    accounts,
    expenses: listData.expenses,
    summary: listData.summary,
  };
}
