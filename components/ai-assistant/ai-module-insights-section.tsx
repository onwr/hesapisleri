import { AiModuleInsightCard } from "@/components/ai-assistant/ai-module-insight-card";
import type { AiInsightModuleKey } from "@/lib/ai/ai-drawer-utils";

/**
 * Inline modül AI kartları artık varsayılan olarak render edilmez.
 * Drawer içinde `AiDrawerInsightContent` kullanılır.
 * Bu bileşen yalnızca koşullu / legacy kullanım içindir.
 */
const MODULE_INSIGHTS: Record<
  Exclude<AiInsightModuleKey, "dashboard">,
  Array<{ title: string }>
> = {
  sales: [{ title: "Satış eğilimi ve ürün analizi" }],
  products: [{ title: "Kritik ve hareketsiz stok analizi" }],
  "cash-bank": [{ title: "Nakit akışı ve hesap özeti" }],
  invoices: [{ title: "Geciken ve yaklaşan tahsilatlar" }],
  customers: [{ title: "Müşteri finansal özeti ve tahsilat önceliği" }],
};

type AiModuleInsightsSectionProps = {
  moduleKey: Exclude<AiInsightModuleKey, "dashboard">;
  enabled?: boolean;
};

export function AiModuleInsightsSection({
  moduleKey,
  enabled = false,
}: AiModuleInsightsSectionProps) {
  if (!enabled) return null;

  const items = MODULE_INSIGHTS[moduleKey];

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <AiModuleInsightCard
          key={`${moduleKey}-${item.title}`}
          moduleKey={moduleKey}
          title={item.title}
        />
      ))}
    </section>
  );
}
