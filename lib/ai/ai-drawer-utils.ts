export type AiInsightModuleKey =
  | "dashboard"
  | "sales"
  | "products"
  | "cash-bank"
  | "invoices"
  | "customers";

export type AiDrawerTab = "chat" | "insight";

export const AI_INSIGHT_TITLES: Record<AiInsightModuleKey, string> = {
  dashboard: "AI Yönetici Özeti",
  sales: "Satış eğilimi ve ürün analizi",
  products: "Kritik ve hareketsiz stok analizi",
  "cash-bank": "Nakit akışı ve hesap özeti",
  invoices: "Geciken ve yaklaşan tahsilatlar",
  customers: "Müşteri finansal özeti ve tahsilat önceliği",
};

export function getAiInsightEndpoint(moduleKey: AiInsightModuleKey) {
  return moduleKey === "dashboard"
    ? "/api/ai/insights/dashboard"
    : `/api/ai/insights/${moduleKey}`;
}
