import type { EntitlementRegistryEntry } from "@/lib/billing/entitlements/entitlement-types";

export const ENTITLEMENT_CATEGORIES = {
  CORE_MODULES: "Temel Modüller",
  FINANCE: "Finans",
  INVENTORY: "Stok ve Operasyon",
  HR: "İnsan Kaynakları",
  INTEGRATIONS: "Entegrasyonlar",
  REPORTING: "Raporlama",
  AI_AUTOMATION: "Yapay Zekâ ve Otomasyon",
  SUPPORT_PLATFORM: "Destek ve Platform",
} as const;

const feature = (
  code: string,
  label: string,
  description: string,
  category: EntitlementRegistryEntry["category"]
): EntitlementRegistryEntry => ({
  code,
  label,
  description,
  category,
  kind: "FEATURE",
  valueType: "BOOLEAN",
  metered: false,
  resetPeriod: "NONE",
  defaultBehavior: "DENY",
  blockingBehavior: "BLOCK_CREATE",
});

const limit = (
  code: string,
  label: string,
  description: string,
  category: EntitlementRegistryEntry["category"],
  unit: string,
  metered = false,
  resetPeriod: EntitlementRegistryEntry["resetPeriod"] = "NONE"
): EntitlementRegistryEntry => ({
  code,
  label,
  description,
  category,
  kind: "LIMIT",
  valueType: "NUMBER",
  unit,
  metered,
  resetPeriod,
  defaultBehavior: "ZERO",
  blockingBehavior: "BLOCK_CREATE",
});

export const ENTITLEMENT_REGISTRY: Record<string, EntitlementRegistryEntry> = {
  DASHBOARD: feature("DASHBOARD", "Panel", "Ana kontrol paneli", "CORE_MODULES"),
  POS: feature("POS", "POS", "Satış noktası modülü", "CORE_MODULES"),
  PRODUCTS: feature("PRODUCTS", "Ürünler", "Ürün yönetimi", "CORE_MODULES"),
  CUSTOMERS: feature("CUSTOMERS", "Müşteriler", "Müşteri yönetimi", "CORE_MODULES"),
  SUPPLIERS: feature("SUPPLIERS", "Tedarikçiler", "Tedarikçi yönetimi", "CORE_MODULES"),
  SALES: feature("SALES", "Satışlar", "Satış işlemleri", "FINANCE"),
  INVOICES: feature("INVOICES", "Faturalar", "Fatura yönetimi", "FINANCE"),
  EXPENSES: feature("EXPENSES", "Giderler", "Gider yönetimi", "FINANCE"),
  CASH_BANK: feature("CASH_BANK", "Kasa/Banka", "Kasa ve banka hesapları", "FINANCE"),
  EMPLOYEES: feature("EMPLOYEES", "Çalışanlar", "Çalışan yönetimi", "HR"),
  PAYROLL: feature("PAYROLL", "Bordro", "Bordro modülü", "HR"),
  MULTI_WAREHOUSE: feature(
    "MULTI_WAREHOUSE",
    "Çoklu Depo",
    "Birden fazla depo kullanımı",
    "INVENTORY"
  ),
  MARKETPLACE: feature("MARKETPLACE", "Pazaryeri", "Pazaryeri entegrasyonları", "INTEGRATIONS"),
  REPORTS: feature("REPORTS", "Raporlar", "Temel raporlar", "REPORTING"),
  ADVANCED_REPORTS: feature(
    "ADVANCED_REPORTS",
    "Gelişmiş Raporlar",
    "Gelişmiş raporlama",
    "REPORTING"
  ),
  OCR: feature("OCR", "OCR", "Belge OCR işlemleri", "AI_AUTOMATION"),
  E_DOCUMENT: feature("E_DOCUMENT", "e-Belge", "e-Fatura/e-Arşiv", "INTEGRATIONS"),
  API_ACCESS: feature("API_ACCESS", "API Erişimi", "API ve token erişimi", "INTEGRATIONS"),
  EXPORT: feature("EXPORT", "Dışa Aktarma", "Veri dışa aktarma", "REPORTING"),
  PRIORITY_SUPPORT: feature(
    "PRIORITY_SUPPORT",
    "Öncelikli Destek",
    "Öncelikli destek hattı",
    "SUPPORT_PLATFORM"
  ),
  MULTI_COMPANY: feature(
    "MULTI_COMPANY",
    "Çoklu Firma",
    "Birden fazla firma yönetimi",
    "SUPPORT_PLATFORM"
  ),
  AUTOMATIONS: feature("AUTOMATIONS", "Otomasyonlar", "İş akışı otomasyonları", "AI_AUTOMATION"),
  ADVANCED_PERMISSIONS: feature(
    "ADVANCED_PERMISSIONS",
    "Gelişmiş Yetkiler",
    "Detaylı yetki yönetimi",
    "SUPPORT_PLATFORM"
  ),

  MAX_USERS: limit("MAX_USERS", "Maks. Kullanıcı", "Firma kullanıcı limiti", "SUPPORT_PLATFORM", "kullanıcı"),
  MAX_COMPANIES: limit(
    "MAX_COMPANIES",
    "Maks. Firma",
    "Kullanıcı başına firma limiti",
    "SUPPORT_PLATFORM",
    "firma"
  ),
  MAX_WAREHOUSES: limit("MAX_WAREHOUSES", "Maks. Depo", "Depo limiti", "INVENTORY", "depo"),
  MAX_PRODUCTS: limit("MAX_PRODUCTS", "Maks. Ürün", "Ürün limiti", "INVENTORY", "ürün"),
  MAX_MARKETPLACES: limit(
    "MAX_MARKETPLACES",
    "Maks. Pazaryeri",
    "Pazaryeri entegrasyon limiti",
    "INTEGRATIONS",
    "entegrasyon"
  ),
  MAX_EMPLOYEES: limit("MAX_EMPLOYEES", "Maks. Çalışan", "Çalışan limiti", "HR", "çalışan"),
  MONTHLY_E_DOCUMENTS: limit(
    "MONTHLY_E_DOCUMENTS",
    "Aylık e-Belge",
    "Aylık e-belge kotası",
    "INTEGRATIONS",
    "belge",
    true,
    "MONTHLY"
  ),
  MONTHLY_OCR_SCANS: limit(
    "MONTHLY_OCR_SCANS",
    "Aylık OCR",
    "Aylık OCR tarama kotası",
    "AI_AUTOMATION",
    "tarama",
    true,
    "MONTHLY"
  ),
  MONTHLY_EXPORTS: limit(
    "MONTHLY_EXPORTS",
    "Aylık Dışa Aktarma",
    "Aylık export kotası",
    "REPORTING",
    "export",
    true,
    "MONTHLY"
  ),
  MONTHLY_API_REQUESTS: limit(
    "MONTHLY_API_REQUESTS",
    "Aylık API",
    "Aylık API istek kotası",
    "INTEGRATIONS",
    "istek",
    true,
    "MONTHLY"
  ),
  STORAGE_MB: limit("STORAGE_MB", "Depolama", "Dosya depolama kotası", "INVENTORY", "MB"),
  MONTHLY_AUTOMATIONS: limit(
    "MONTHLY_AUTOMATIONS",
    "Aylık Otomasyon",
    "Aylık otomasyon çalıştırma kotası",
    "AI_AUTOMATION",
    "otomasyon",
    true,
    "MONTHLY"
  ),
};

export const FEATURE_CODES = Object.values(ENTITLEMENT_REGISTRY)
  .filter((e) => e.kind === "FEATURE")
  .map((e) => e.code);

export const LIMIT_CODES = Object.values(ENTITLEMENT_REGISTRY)
  .filter((e) => e.kind === "LIMIT")
  .map((e) => e.code);

export function getEntitlementMeta(code: string): EntitlementRegistryEntry | null {
  return ENTITLEMENT_REGISTRY[code] ?? null;
}

export function isKnownEntitlementCode(code: string) {
  return code in ENTITLEMENT_REGISTRY;
}

export function listEntitlementsByCategory() {
  const grouped = new Map<string, EntitlementRegistryEntry[]>();
  for (const entry of Object.values(ENTITLEMENT_REGISTRY)) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return grouped;
}
