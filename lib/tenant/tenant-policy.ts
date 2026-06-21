/**
 * Tenant model inventory for RLS rollout and static audits.
 * A = direct companyId, B = indirect via parent, C = global, D = auth, E = system/admin
 */

export const DIRECT_TENANT_MODELS = [
  "Customer",
  "Supplier",
  "DirectoryContact",
  "Product",
  "ProductCategory",
  "Warehouse",
  "WarehouseStock",
  "WarehouseTransfer",
  "StockMovement",
  "Sale",
  "Invoice",
  "Expense",
  "Account",
  "Employee",
  "Notification",
  "ActivityLog",
  "CalendarEvent",
  "ProductChannelMapping",
  "MarketplaceIntegration",
] as const;

export const INDIRECT_TENANT_MODELS = [
  "SaleItem",
  "InvoiceItem",
  "AccountTransaction",
  "WarehouseTransferItem",
  "PayrollRunItem",
  "SupplierContact",
  "SupplierProduct",
] as const;

export const GLOBAL_MODELS = [
  "MembershipPlan",
  "PartnerSettings",
] as const;

export const AUTH_MODELS = ["User", "Company", "CompanyUser", "CompanyInvite"] as const;

export const SYSTEM_ADMIN_MODELS = [
  "PartnerApplication",
  "PartnerProfile",
  "PartnerReferralClick",
  "PartnerConversion",
  "PartnerEarning",
  "PartnerPayout",
] as const;

export const RLS_PHASE_ONE_TABLES = [
  "Customer",
  "Supplier",
  "Product",
  "Warehouse",
  "WarehouseStock",
  "StockMovement",
  "Sale",
  "Invoice",
  "Expense",
  "Account",
  "Employee",
  "DirectoryContact",
] as const;
