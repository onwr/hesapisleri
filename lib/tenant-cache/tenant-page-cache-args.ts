import type { parseSuppliersPageOptions } from "@/lib/supplier-page-data";

export type SalesPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  from: Date;
  to: Date;
};

export type ProductsPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  category?: string | null;
  q?: string | null;
  stock?: string;
  sort?: string;
};

export type CustomersPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  group?: string | null;
  q?: string | null;
};

export type CustomerLedgerCacheArgs = {
  companyId: string;
  customerId: string;
};

export type CustomerDetailCacheArgs = {
  companyId: string;
  customerId: string;
};

export type SuppliersPageCacheArgs = {
  companyId: string;
  options: ReturnType<typeof parseSuppliersPageOptions>;
};

export type CashBankPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  q?: string | null;
};

export type ExpensesPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  from: Date;
  to: Date;
  q?: string | null;
  category?: string | null;
};

export type StocksPageCacheArgs = {
  companyId: string;
  tab: string;
  page: number;
  from: Date;
  to: Date;
  q?: string | null;
  productId?: string | null;
};

export type WarehouseDetailCacheArgs = {
  companyId: string;
  warehouseId: string;
};

export type EmployeeDetailCacheArgs = {
  companyId: string;
  employeeId: string;
  includeSensitive?: boolean;
};

export type ReportsPageCacheArgs = {
  companyId: string;
  tab: string;
  from: Date;
  to: Date;
};

export type SupplierDetailCacheArgs = {
  companyId: string;
  supplierId: string;
};

export type SaleDetailCacheArgs = {
  companyId: string;
  saleId: string;
};

export type ProductDetailCacheArgs = {
  companyId: string;
  productId: string;
};

export type ExpenseDetailCacheArgs = {
  companyId: string;
  expenseId: string;
};

export type CashBankAccountDetailCacheArgs = {
  companyId: string;
  accountId: string;
};

export type AccountTransactionDetailCacheArgs = {
  companyId: string;
  transactionId: string;
};
