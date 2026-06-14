import Link from "next/link";
import { ArrowRight, CheckCircle2, Tags } from "lucide-react";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";

const RESOLUTION_STEPS = [
  "Önce kayıtlı kanal eşlemesine bakılır (merchant SKU → panel ürünü).",
  "Eşleme yoksa panel ürün SKU’su ile otomatik deneme yapılır.",
  "Yine bulunamazsa barkod ile eşleşme denenir.",
  "Hiçbiri tutmazsa sipariş Eşleşme Bekliyor durumuna düşer; stok düşmez.",
] as const;

const WORKFLOW_STEPS = [
  "Pazaryeri bağlantısını yapılandırın ve test edin.",
  "Şimdi Çek ile ilk siparişleri içeri alın.",
  "Siparişler → Eşleşme Bekleyen sekmesinden eşleşmeyen SKU’ları görün.",
  "Ürün Eşlemeleri sayfasında merchant SKU’yu panel ürünüyle eşleyin.",
  "Siparişi onaylayın; onay sonrası stok hareketi oluşturulur.",
] as const;

type IntegrationSkuMappingGuideProps = {
  variant?: "panel" | "page";
};

export function IntegrationSkuMappingGuide({
  variant = "page",
}: IntegrationSkuMappingGuideProps) {
  if (variant === "panel") {
    return (
      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 text-slate-900">
          <Tags size={18} />
          <h4 className="text-sm font-black">SKU Eşleme Nedir?</h4>
        </div>

        <p className="mt-3 text-xs leading-6 text-slate-600">
          Pazaryerinden gelen her sipariş kalemi bir{" "}
          <strong className="font-black text-slate-800">merchant SKU</strong>{" "}
          (satıcı stok kodu) taşır. Paneldeki ürünlerin SKU ve barkodları farklı
          olabilir. SKU eşleme, pazaryeri kodunu doğru panel ürününe bağlar.
        </p>

        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Sistem nasıl eşleştirir?
          </p>
          <ul className="space-y-1.5 text-xs leading-5 text-slate-600">
            {RESOLUTION_STEPS.map((step) => (
              <li key={step} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-blue-950">
          Bu entegrasyon ürün kataloğu çekmez. Pazaryerinden siparişleri çeker.
          Ürünlerinizi panelde manuel/CSV ile oluşturabilir, pazaryeri merchant SKU
          değerlerini Ürün Eşleme sayfasından panel ürünleriyle eşleştirebilirsiniz.
        </div>

        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900">
          Eşleşmeyen siparişler otomatik onaylanmaz ve stok düşmez. Eşlemeyi
          tamamladıktan sonra siparişi manuel onaylamanız gerekir.
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <MappingLink channel="TRENDYOL" label="Trendyol Eşlemeleri" />
          <MappingLink channel="HEPSIBURADA" label="Hepsiburada Eşlemeleri" />
          <Link
            href="/orders?tab=matching"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[11px] font-black text-slate-700 hover:bg-slate-50"
          >
            Eşleşme Bekleyen Siparişler
            <ArrowRight size={12} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-blue-100/80 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/50 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">
            Operasyon Akışı
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950">SKU Eşleme Nedir?</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Trendyol ve Hepsiburada siparişlerinde her ürün satırı bir{" "}
            <strong className="font-black text-slate-900">merchant SKU</strong> ile
            gelir. Bu kod, paneldeki ürün SKU’nuzdan farklı olabilir. SKU eşleme;
            pazaryerindeki kodu panel ürününüzle ilişkilendirerek siparişin doğru
            stok kartına bağlanmasını sağlar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IntegrationChannelLogo channel="TRENDYOL" size="sm" />
          <IntegrationChannelLogo channel="HEPSIBURADA" size="sm" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <GuideBlock
          title="Sistem eşleşme sırası"
          items={RESOLUTION_STEPS}
        />
        <GuideBlock title="Önerilen iş akışı" items={WORKFLOW_STEPS} numbered />
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-950">
        Bu entegrasyon ürün kataloğu çekmez. Pazaryerinden siparişleri çeker.
        Ürünlerinizi panelde manuel/CSV ile oluşturabilir, pazaryeri merchant SKU
        değerlerini Ürün Eşleme sayfasından panel ürünleriyle eşleştirebilirsiniz.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoPill
          title="Eşleşmeyen sipariş"
          text="WAITING durumuna düşer, Siparişler → Eşleşme Bekleyen sekmesinde görünür."
        />
        <InfoPill
          title="Stok davranışı"
          text="Sync sırasında stok düşmez. Stok hareketi sipariş onayından sonra oluşur."
        />
        <InfoPill
          title="Otomatik eşleşme"
          text="Merchant SKU, panel SKU veya barkod ile birebir aynıysa eşleme otomatik yapılır."
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <MappingLink channel="TRENDYOL" label="Trendyol Ürün Eşlemeleri" primary />
        <MappingLink channel="HEPSIBURADA" label="Hepsiburada Ürün Eşlemeleri" primary />
        <Link
          href="/orders?tab=matching"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          Eşleşme Bekleyen Siparişler
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

function GuideBlock({
  title,
  items,
  numbered,
}: {
  title: string;
  items: readonly string[];
  numbered?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
      <p className="text-xs font-black text-slate-900">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2.5 text-sm leading-6 text-slate-600">
            {numbered ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700">
                {index + 1}
              </span>
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoPill({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/90 px-3 py-3">
      <p className="text-xs font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function MappingLink({
  channel,
  label,
  primary,
}: {
  channel: "TRENDYOL" | "HEPSIBURADA";
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={`/products/channel-mapping?channel=${channel}`}
      className={[
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black",
        primary
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "border border-slate-200 text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      <IntegrationChannelLogo channel={channel} size="sm" className="h-6 w-6" />
      {label}
    </Link>
  );
}
