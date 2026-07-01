import "server-only";

import { getCashBankPageData } from "@/lib/cash-bank-page-data";
import {
  getCustomerDetailLedgerData,
  getCustomerDetailRecord,
} from "@/lib/customer-detail-data";
import { getCustomersPageData } from "@/lib/customers-page-data";
import { getEmployeeDetailPageData } from "@/lib/employee-page-data";
import { getExpensesPageData } from "@/lib/expenses-page-data";
import { getExpenseDetail } from "@/lib/expense-service";
import { getAccountDetailData } from "@/lib/cash-bank-account-service";
import { getAccountTransactionDetail } from "@/lib/cash-bank/get-account-transaction-detail";
import { getProductDetailData } from "@/lib/product-detail-data";
import { getProductsPageData } from "@/lib/products-page-data";
import { getReportsPageData } from "@/lib/reports-page-data";
import { getSaleDetailData } from "@/lib/sale-detail-data";
import { getSalesPageData } from "@/lib/sales-page-data";
import { getStocksPageData } from "@/lib/stocks-page-data";
import { getSuppliersPageData } from "@/lib/supplier-page-data";
import {
  getWarehouseDetailData,
  getWarehousesPageData,
} from "@/lib/warehouse-page-data";
import { getSupplierDetailData } from "@/lib/supplier-detail-data";
import { getSupplierDetailLedgerData } from "@/lib/supplier-detail-ledger-data";
import { withTenantPageCache } from "./tenant-page-cache";
import type {
  AccountTransactionDetailCacheArgs,
  CashBankAccountDetailCacheArgs,
  CashBankPageCacheArgs,
  CustomerDetailCacheArgs,
  CustomerLedgerCacheArgs,
  CustomersPageCacheArgs,
  EmployeeDetailCacheArgs,
  ExpenseDetailCacheArgs,
  ExpensesPageCacheArgs,
  ProductDetailCacheArgs,
  ProductsPageCacheArgs,
  ReportsPageCacheArgs,
  SaleDetailCacheArgs,
  SalesPageCacheArgs,
  StocksPageCacheArgs,
  SupplierDetailCacheArgs,
  SuppliersPageCacheArgs,
  WarehouseDetailCacheArgs,
} from "./tenant-page-cache-args";

export const getCachedSalesPageData = withTenantPageCache<
  SalesPageCacheArgs,
  Awaited<ReturnType<typeof getSalesPageData>>
>({
  domain: "sales",
  cacheKey: (args) => [
    "sales-page",
    args.tab,
    String(args.page),
    args.from.toISOString(),
    args.to.toISOString(),
  ],
  loader: (args) =>
    getSalesPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getSalesPageData>[1]["tab"],
      page: args.page,
      from: args.from,
      to: args.to,
    }),
});

export const getCachedProductsPageData = withTenantPageCache<
  ProductsPageCacheArgs,
  Awaited<ReturnType<typeof getProductsPageData>>
>({
  domain: "products",
  cacheKey: (args) => [
    "products-page",
    args.tab,
    String(args.page),
    args.category ?? "",
    args.q ?? "",
    args.stock ?? "",
    args.sort ?? "",
  ],
  loader: (args) =>
    getProductsPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getProductsPageData>[1]["tab"],
      page: args.page,
      category: args.category ?? undefined,
      q: args.q ?? undefined,
      stock: args.stock as Parameters<typeof getProductsPageData>[1]["stock"],
      sort: args.sort as Parameters<typeof getProductsPageData>[1]["sort"],
    }),
});

export const getCachedCustomersPageData = withTenantPageCache<
  CustomersPageCacheArgs,
  Awaited<ReturnType<typeof getCustomersPageData>>
>({
  domain: "customers",
  cacheKey: (args) => [
    "customers-page",
    args.tab,
    String(args.page),
    args.group ?? "",
    args.q ?? "",
  ],
  loader: (args) =>
    getCustomersPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getCustomersPageData>[1]["tab"],
      page: args.page,
      group: args.group ?? undefined,
      q: args.q ?? undefined,
    }),
});

export const getCachedCustomerDetailData = withTenantPageCache<
  CustomerDetailCacheArgs,
  Awaited<ReturnType<typeof getCustomerDetailRecord>>
>({
  domain: "customer-detail",
  entityId: (args) => args.customerId,
  cacheKey: (args) => ["customer-detail", args.customerId],
  loader: (args) => getCustomerDetailRecord(args.companyId, args.customerId),
});

export const getCachedCustomerLedgerData = withTenantPageCache<
  CustomerLedgerCacheArgs,
  Awaited<ReturnType<typeof getCustomerDetailLedgerData>>
>({
  domain: "customer-ledger",
  entityId: (args) => args.customerId,
  cacheKey: (args) => ["customer-ledger", args.customerId],
  loader: (args) => getCustomerDetailLedgerData(args.companyId, args.customerId),
});

export const getCachedSuppliersPageData = withTenantPageCache<
  SuppliersPageCacheArgs,
  Awaited<ReturnType<typeof getSuppliersPageData>>
>({
  domain: "suppliers",
  cacheKey: (args) => ["suppliers-page", JSON.stringify(args.options)],
  loader: (args) => getSuppliersPageData(args.companyId, args.options),
});

export const getCachedCashBankPageData = withTenantPageCache<
  CashBankPageCacheArgs,
  Awaited<ReturnType<typeof getCashBankPageData>>
>({
  domain: "cash-bank",
  cacheKey: (args) => [
    "cash-bank-page",
    args.tab,
    String(args.page),
    args.q ?? "",
  ],
  loader: (args) =>
    getCashBankPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getCashBankPageData>[1]["tab"],
      page: args.page,
      q: args.q ?? undefined,
    }),
});

export const getCachedExpensesPageData = withTenantPageCache<
  ExpensesPageCacheArgs,
  Awaited<ReturnType<typeof getExpensesPageData>>
>({
  domain: "expenses",
  cacheKey: (args) => [
    "expenses-page",
    args.tab,
    String(args.page),
    args.from.toISOString(),
    args.to.toISOString(),
    args.q ?? "",
    args.category ?? "",
  ],
  loader: (args) =>
    getExpensesPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getExpensesPageData>[1]["tab"],
      page: args.page,
      from: args.from,
      to: args.to,
      q: args.q ?? undefined,
      category: args.category ?? undefined,
    }),
});

export const getCachedStocksPageData = withTenantPageCache<
  StocksPageCacheArgs,
  Awaited<ReturnType<typeof getStocksPageData>>
>({
  domain: "warehouse-stock",
  cacheKey: (args) => [
    "stocks-page",
    args.tab,
    String(args.page),
    args.from.toISOString(),
    args.to.toISOString(),
    args.q ?? "",
    args.productId ?? "",
  ],
  loader: (args) =>
    getStocksPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getStocksPageData>[1]["tab"],
      page: args.page,
      from: args.from,
      to: args.to,
      q: args.q ?? undefined,
      productId: args.productId,
    }),
});

export const getCachedWarehousesPageData = withTenantPageCache<
  { companyId: string },
  Awaited<ReturnType<typeof getWarehousesPageData>>
>({
  domain: "warehouse-stock",
  cacheKey: (args) => ["warehouses-page", args.companyId],
  loader: (args) => getWarehousesPageData(args.companyId),
});

export const getCachedWarehouseDetailData = withTenantPageCache<
  WarehouseDetailCacheArgs,
  Awaited<ReturnType<typeof getWarehouseDetailData>>
>({
  domain: "warehouse-stock",
  entityId: (args) => args.warehouseId,
  cacheKey: (args) => ["warehouse-detail", args.warehouseId],
  loader: (args) => getWarehouseDetailData(args.companyId, args.warehouseId),
});

export const getCachedEmployeeDetailPageData = withTenantPageCache<
  EmployeeDetailCacheArgs,
  Awaited<ReturnType<typeof getEmployeeDetailPageData>>
>({
  domain: "employee-detail",
  entityId: (args) => args.employeeId,
  cacheKey: (args) => ["employee-detail", args.employeeId],
  loader: (args) => getEmployeeDetailPageData(args),
});

export const getCachedReportsPageData = withTenantPageCache<
  ReportsPageCacheArgs,
  Awaited<ReturnType<typeof getReportsPageData>>
>({
  domain: "reports",
  cacheKey: (args) => [
    "reports-page",
    args.tab,
    args.from.toISOString(),
    args.to.toISOString(),
  ],
  loader: (args) =>
    getReportsPageData(args.companyId, {
      tab: args.tab as Parameters<typeof getReportsPageData>[1]["tab"],
      from: args.from,
      to: args.to,
    }),
});

export const getCachedSupplierDetailData = withTenantPageCache<
  SupplierDetailCacheArgs,
  Awaited<ReturnType<typeof getSupplierDetailData>>
>({
  domain: "supplier-detail",
  entityId: (args) => args.supplierId,
  cacheKey: (args) => ["supplier-detail", args.supplierId],
  loader: (args) => getSupplierDetailData(args.companyId, args.supplierId),
});

export const getCachedSupplierLedgerData = withTenantPageCache<
  SupplierDetailCacheArgs,
  Awaited<ReturnType<typeof getSupplierDetailLedgerData>>
>({
  domain: "supplier-ledger",
  entityId: (args) => args.supplierId,
  cacheKey: (args) => ["supplier-ledger", args.supplierId],
  loader: (args) => getSupplierDetailLedgerData(args.companyId, args.supplierId),
});

export const getCachedSaleDetailData = withTenantPageCache<
  SaleDetailCacheArgs,
  Awaited<ReturnType<typeof getSaleDetailData>>
>({
  domain: "sale-detail",
  entityId: (args) => args.saleId,
  cacheKey: (args) => ["sale-detail", args.saleId],
  loader: (args) => getSaleDetailData(args.companyId, args.saleId),
});

export const getCachedProductDetailData = withTenantPageCache<
  ProductDetailCacheArgs,
  Awaited<ReturnType<typeof getProductDetailData>>
>({
  domain: "product-detail",
  entityId: (args) => args.productId,
  cacheKey: (args) => ["product-detail", args.productId],
  loader: (args) => getProductDetailData(args.companyId, args.productId),
});

export const getCachedExpenseDetailData = withTenantPageCache<
  ExpenseDetailCacheArgs,
  Awaited<ReturnType<typeof getExpenseDetail>>
>({
  domain: "expenses",
  entityId: (args) => args.expenseId,
  cacheKey: (args) => ["expense-detail", args.expenseId],
  loader: (args) => getExpenseDetail(args.companyId, args.expenseId),
});

export const getCachedCashBankAccountDetailData = withTenantPageCache<
  CashBankAccountDetailCacheArgs,
  Awaited<ReturnType<typeof getAccountDetailData>>
>({
  domain: "cash-bank",
  entityId: (args) => args.accountId,
  cacheKey: (args) => ["cash-bank-account-detail", args.accountId],
  loader: (args) => getAccountDetailData(args.companyId, args.accountId),
});

export const getCachedAccountTransactionDetailData = withTenantPageCache<
  AccountTransactionDetailCacheArgs,
  Awaited<ReturnType<typeof getAccountTransactionDetail>>
>({
  domain: "cash-bank",
  entityId: (args) => args.transactionId,
  cacheKey: (args) => ["cash-bank-transaction-detail", args.transactionId],
  loader: (args) => getAccountTransactionDetail(args.companyId, args.transactionId),
});
