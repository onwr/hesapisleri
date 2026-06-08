"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  FileText,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";

export type AuthBrandVariant = "login" | "register" | "onboarding" | "invite";

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const variantConfig: Record<
  AuthBrandVariant,
  { eyebrow: string; title: string; description: string; features: FeatureItem[] }
> = {
  login: {
    eyebrow: "İşletme yönetim platformu",
    title: "Satıştan stoğa, tek panelde tam kontrol.",
    description:
      "POS, stok, fatura, kasa ve müşteri takibini aynı modern arayüzde yönetin. Ekibiniz için güvenilir, hızlı ve ölçeklenebilir.",
    features: [
      {
        icon: Store,
        title: "POS & satış",
        description: "Hızlı satış, depo bazlı stok ve tahsilat yönetimi.",
      },
      {
        icon: Boxes,
        title: "Stok & depo",
        description: "Çoklu depo, transfer ve stok hareketleri tek merkezde.",
      },
      {
        icon: Wallet,
        title: "Kasa & finans",
        description: "Tahsilat, gider ve kasa hareketlerini anlık izleyin.",
      },
    ],
  },
  register: {
    eyebrow: "14 gün ücretsiz deneme",
    title: "İşletmenizi dakikalar içinde dijitalleştirin.",
    description:
      "Kayıt sonrası adım adım kurulum sizi karşılar. Satış, stok, fatura ve müşteri süreçlerini tek yerden yönetmeye başlayın.",
    features: [
      {
        icon: Sparkles,
        title: "Hızlı kurulum",
        description: "Firma bilgileri, logo ve varsayılan ayarlar birkaç adımda.",
      },
      {
        icon: Receipt,
        title: "Satış & fatura",
        description: "Teklif, satış ve fatura akışları hazır şablonlarla.",
      },
      {
        icon: BarChart3,
        title: "Canlı özetler",
        description: "Dashboard ile stok, satış ve finans görünürlüğü.",
      },
    ],
  },
  onboarding: {
    eyebrow: "Kurulum sihirbazı",
    title: "Firmanızı panele uygun hale getirin.",
    description:
      "Logo, iletişim ve varsayılan ayarları tamamladığınızda ekip aynı standartlarla çalışmaya başlar.",
    features: [
      {
        icon: FileText,
        title: "Resmi bilgiler",
        description: "Vergi ve adres bilgileri faturalarda düzenli görünür.",
      },
      {
        icon: ShieldCheck,
        title: "Güvenilir kayıt",
        description: "Firma verileri şirket bazında izole saklanır.",
      },
      {
        icon: Users,
        title: "Ekip için hazır",
        description: "Kurulum sonrası davet ve rol yönetimine geçebilirsiniz.",
      },
    ],
  },
  invite: {
    eyebrow: "Ekip daveti",
    title: "Şirketinize güvenle katılın.",
    description:
      "Davet bağlantısı ile rolünüz tanımlanır; mevcut hesabınızla veya yeni kayıtla ekibe dahil olabilirsiniz.",
    features: [
      {
        icon: ShieldCheck,
        title: "Güvenli davet",
        description: "Süreli token ile yalnızca yetkili kullanıcılar kabul eder.",
      },
      {
        icon: Users,
        title: "Rol bazlı erişim",
        description: "POS, satış, stok ve finans modülleri role göre açılır.",
      },
      {
        icon: Store,
        title: "Anında başlangıç",
        description: "Kabul sonrası giriş yaparak panele devam edin.",
      },
    ],
  },
};

type AuthBrandPanelProps = {
  variant: AuthBrandVariant;
  compact?: boolean;
};

export function AuthBrandPanel({ variant, compact = false }: AuthBrandPanelProps) {
  const config = variantConfig[variant];

  return (
    <div className={compact ? "space-y-5" : "flex h-full flex-col justify-between p-8 xl:p-12"}>
      <div>
        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-blue-100">
          {config.eyebrow}
        </span>

        <h1
          className={[
            "mt-5 font-black leading-tight text-white",
            compact ? "text-2xl" : "text-3xl xl:text-4xl",
          ].join(" ")}
        >
          {config.title}
        </h1>

        <p
          className={[
            "mt-4 leading-7 text-slate-300",
            compact ? "text-sm" : "max-w-lg text-[15px]",
          ].join(" ")}
        >
          {config.description}
        </p>
      </div>

      {!compact ? (
        <div className="mt-10 space-y-3">
          {config.features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100">
                <feature.icon size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-sm font-black text-white">{feature.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-8 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} HESAPİŞLERİ.COM | TAMPAZAR ELEKTRONİK TİCARET SANAYİ LTD. ŞTİ.
        </p>
      ) : null}
    </div>
  );
}
