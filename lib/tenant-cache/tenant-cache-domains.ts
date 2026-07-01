/** Tenant uygulama cache domain'leri — server revalidateTag + client sync registry. */
export const TENANT_CACHE_DOMAINS = [
  "dashboard",
  "sales",
  "sale-detail",
  "products",
  "product-detail",
  "warehouse-stock",
  "stock-movements",
  "customers",
  "customer-detail",
  "customer-ledger",
  "suppliers",
  "supplier-detail",
  "supplier-ledger",
  "cash-bank",
  "expenses",
  "employees",
  "employee-detail",
  "reports",
  "notifications",
  "orders",
  "order-detail",
  "quotes",
  "invoices",
  "invoice-detail",
] as const;

export type TenantCacheDomain = (typeof TENANT_CACHE_DOMAINS)[number];

export type TenantEntityIds = {
  saleId?: string;
  productId?: string;
  warehouseId?: string;
  customerId?: string;
  supplierId?: string;
  employeeId?: string;
  accountId?: string;
  expenseId?: string;
  orderId?: string;
  invoiceId?: string;
};
