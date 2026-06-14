"use client";

import { Clock3, Link2, ShieldCheck } from "lucide-react";
import { IntegrationSkuMappingGuide } from "@/components/settings/integrations/integration-sku-mapping-guide";

export function IntegrationHelpPanel() {
  return (
    <aside className="space-y-4 xl:sticky xl:top-24">
      <section className="rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
          Operasyon Rehberi
        </p>
        <h3 className="mt-2 text-lg font-black">Entegrasyon İpuçları</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Bağlantıları yapılandırın, test edin ve siparişleri güvenli akışla içeri alın.
        </p>
      </section>

      <HelpCard
        icon={<ShieldCheck size={18} />}
        title="Güvenli Credential Saklama"
        text="API anahtarlarınız şifrelenerek saklanır. Secret değerleri tekrar görüntülenmez."
      />
      <HelpCard
        icon={<Link2 size={18} />}
        title="Senkronizasyon Mantığı"
        text="Siparişler çekilirken stok otomatik düşmez. Eşleşme ve onay sonrası stok hareketi oluşturulur."
      />
      <HelpCard
        icon={<Clock3 size={18} />}
        title="Cron Hazırlığı"
        text="Otomatik sync için cron endpoint hazır. CRON_SECRET ile korunur."
      />
      <section className="rounded-[1.75rem] border border-blue-100 bg-blue-50/70 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <p className="text-sm font-black text-blue-950">Ürün kataloğu değil, sipariş</p>
        <p className="mt-2 text-xs leading-5 text-blue-900/90">
          Bu entegrasyon ürün kataloğu çekmez. Pazaryerinden siparişleri çeker.
          Ürünlerinizi panelde manuel/CSV ile oluşturabilir, pazaryeri merchant SKU
          değerlerini Ürün Eşleme sayfasından panel ürünleriyle eşleştirebilirsiniz.
        </p>
      </section>
      <IntegrationSkuMappingGuide variant="panel" />
    </aside>
  );
}

function HelpCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <h4 className="text-sm font-black">{title}</h4>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </section>
  );
}
