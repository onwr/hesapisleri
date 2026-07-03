import {
  ENTITLEMENT_REGISTRY,
  FEATURE_CODES,
  LIMIT_CODES,
  getEntitlementMeta,
} from "@/lib/billing/entitlements/entitlement-registry";
import type { EntitlementInputRow } from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import type { PlanBillingPeriod } from "@/lib/admin/plans/admin-plan-period-pricing-utils";

export type FeatureUiGroup = {
  key: string;
  label: string;
  codes: string[];
};

export const FEATURE_UI_GROUPS: FeatureUiGroup[] = [
  { key: "sales", label: "Satış", codes: ["POS", "SALES"] },
  { key: "inventory", label: "Ürün ve Stok", codes: ["PRODUCTS", "MULTI_WAREHOUSE"] },
  { key: "invoice", label: "Fatura", codes: ["INVOICES", "E_DOCUMENT"] },
  { key: "finance", label: "Finans", codes: ["EXPENSES", "CASH_BANK"] },
  {
    key: "crm",
    label: "Müşteri ve Tedarikçi",
    codes: ["CUSTOMERS", "SUPPLIERS"],
  },
  { key: "hr", label: "Çalışan", codes: ["EMPLOYEES", "PAYROLL"] },
  { key: "ecommerce", label: "E-Ticaret", codes: ["MARKETPLACE"] },
  {
    key: "reports",
    label: "Raporlar",
    codes: ["REPORTS", "ADVANCED_REPORTS", "EXPORT"],
  },
  {
    key: "ai",
    label: "Yapay Zekâ",
    codes: ["OCR", "AUTOMATIONS"],
  },
  {
    key: "other",
    label: "Diğer",
    codes: [
      "DASHBOARD",
      "API_ACCESS",
      "PRIORITY_SUPPORT",
      "MULTI_COMPANY",
      "ADVANCED_PERMISSIONS",
    ],
  },
];

export const RECOMMENDED_FEATURE_CODES = new Set([
  "DASHBOARD",
  "SALES",
  "PRODUCTS",
  "CUSTOMERS",
  "INVOICES",
  "EXPENSES",
  "CASH_BANK",
  "REPORTS",
]);

export const LIMIT_UI_GROUPS: FeatureUiGroup[] = [
  {
    key: "platform",
    label: "Platform",
    codes: ["MAX_USERS", "MAX_COMPANIES", "STORAGE_MB"],
  },
  {
    key: "inventory",
    label: "Stok",
    codes: ["MAX_WAREHOUSES", "MAX_PRODUCTS"],
  },
  {
    key: "integrations",
    label: "Entegrasyon",
    codes: ["MAX_MARKETPLACES", "MONTHLY_API_REQUESTS", "MONTHLY_E_DOCUMENTS"],
  },
  { key: "hr", label: "İnsan Kaynakları", codes: ["MAX_EMPLOYEES"] },
  {
    key: "usage",
    label: "Kullanım Kotası",
    codes: ["MONTHLY_OCR_SCANS", "MONTHLY_EXPORTS", "MONTHLY_AUTOMATIONS"],
  },
];

export function slugFromPlanName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getLimitsLinkedToFeature(featureCode: string): string[] {
  const meta = getEntitlementMeta(featureCode);
  if (!meta) return [];
  return LIMIT_CODES.filter(
    (code) => ENTITLEMENT_REGISTRY[code]?.category === meta.category
  );
}

export function buildEntitlementRow(code: string, enabled: boolean): EntitlementInputRow {
  const meta = getEntitlementMeta(code);
  if (!meta) {
    return { code, valueType: "BOOLEAN", booleanValue: enabled };
  }
  if (meta.valueType === "BOOLEAN") {
    return {
      code,
      valueType: "BOOLEAN",
      booleanValue: enabled,
      numberValue: null,
      stringValue: null,
      isUnlimited: false,
      category: meta.category,
    };
  }
  if (meta.kind === "LIMIT") {
    return {
      code,
      valueType: "UNLIMITED",
      booleanValue: null,
      numberValue: null,
      stringValue: null,
      isUnlimited: enabled,
      category: meta.category,
    };
  }
  return {
    code,
    valueType: meta.valueType,
    booleanValue: null,
    numberValue: 0,
    stringValue: null,
    isUnlimited: false,
    category: meta.category,
  };
}

export function buildEntitlementsPayload(
  selectedFeatures: Set<string>,
  selectedLimits: Set<string>
): EntitlementInputRow[] {
  const rows: EntitlementInputRow[] = [];
  for (const code of FEATURE_CODES) {
    if (selectedFeatures.has(code)) {
      rows.push(buildEntitlementRow(code, true));
    }
  }
  for (const code of LIMIT_CODES) {
    if (selectedLimits.has(code)) {
      rows.push(buildEntitlementRow(code, true));
    }
  }
  return rows;
}

export function defaultSelectedFeatures(): Set<string> {
  return new Set(FEATURE_CODES);
}

export function defaultSelectedLimits(): Set<string> {
  return new Set(LIMIT_CODES);
}

export function formatSalesStatusLabel(salesOpen: boolean): string {
  return salesOpen ? "Satışa açık" : "Pasif";
}

export function formatSelectionSummary(selected: number, total: number): string {
  if (selected === total) return "Tümü seçili";
  if (selected === 0) return "Hiçbiri seçili değil";
  return `${selected} / ${total} seçili`;
}

export function formatCurrencyAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (currency === "TRY") return `${formatted} TL`;
  return `${formatted} ${currency}`;
}

export type PeriodSummaryLine = {
  interval: PlanBillingPeriod;
  label: string;
  total: number;
  discountPercent: number;
  enabled: boolean;
};
