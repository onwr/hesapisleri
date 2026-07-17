import Image from "next/image";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import {
  MARKETING_BUILTIN_INTEGRATIONS,
  MARKETING_MARKETPLACE_INTEGRATIONS,
} from "@/lib/marketing/integration-catalog";

function LogoCard({
  name,
  src,
  w,
  h,
}: {
  name: string;
  src: string;
  w: number;
  h: number;
}) {
  return (
    <div className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-12 w-full items-center justify-center">
        <Image
          src={src}
          alt={name}
          width={w}
          height={h}
          className="max-h-10 w-auto object-contain"
        />
      </div>
      <p className="text-center text-xs font-medium text-slate-500">{name}</p>
    </div>
  );
}

function BuiltinCard({
  name,
  description,
  tag,
}: {
  name: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex h-12 w-full flex-col items-center justify-center gap-0.5 text-center">
        {name === "Sipay" ? (
          <span className="text-[22px] font-extrabold tracking-tight text-[#1a4fa0]">
            Sipay
          </span>
        ) : (
          <>
            <span className="text-[13px] font-extrabold text-slate-800 leading-none">{name}</span>
            <span className="text-[9px] font-semibold text-emerald-600 tracking-wider uppercase">
              Sovos / Efaturam
            </span>
          </>
        )}
      </div>
      <p className="text-xs text-center text-slate-500">{description}</p>
      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-400">
        {tag}
      </span>
    </div>
  );
}

export function IntegrationsSection() {
  const marketplaceEnabled = isMarketplaceFeatureEnabled();

  return (
    <section id="entegrasyonlar" className="bg-[#07162D] py-20">
      <div className="mx-auto max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Entegrasyonlar
          </p>
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Mevcut iş akışınızla uyumlu
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            {marketplaceEnabled
              ? "Pazaryeri siparişleri, e-Fatura / e-Arşiv ve ödeme altyapısı ile mevcut iş akışınızı tek panelde birleştirin."
              : "e-Fatura / e-Arşiv ve ödeme altyapısı ile satış ve fatura süreçlerinizi tek panelde birleştirin."}
          </p>
        </div>

        {marketplaceEnabled ? (
          <div className="mb-12">
            <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Pazaryeri Entegrasyonları
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {MARKETING_MARKETPLACE_INTEGRATIONS.map((item) => (
                <LogoCard
                  key={item.key}
                  name={item.name}
                  src={item.logoSrc}
                  w={item.logoWidth}
                  h={item.logoHeight}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className={marketplaceEnabled ? "border-t border-white/[0.06] pt-12" : ""}>
          <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Dahili Özellikler
          </p>
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            {MARKETING_BUILTIN_INTEGRATIONS.map((item) => (
              <BuiltinCard
                key={item.key}
                name={item.name}
                description={item.description}
                tag={item.tag}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
