"use client";

import { useState } from "react";

const CORE_FAQ_ITEMS = [
  {
    q: "Deneme süresi boyunca kredi kartı gerekiyor mu?",
    a: "Hayır. Deneme sürecinizde herhangi bir ödeme bilgisi girmenize gerek yoktur. Deneme süreniz dolduğunda ve devam etmek isterseniz ödeme bilgilerinizi girmeniz istenir.",
  },
  {
    q: "Verilerim nerede saklanıyor?",
    a: "Tüm verileriniz Türkiye'deki sunucularda saklanmaktadır. Veri gizliliğini ön planda tutan altyapı kullanılmaktadır.",
  },
  {
    q: "e-Fatura mükellefiyeti zorunlu mu?",
    a: "Hayır. e-Fatura mükellefi değilseniz e-Arşiv faturası keserek kullanabilirsiniz. e-Fatura mükellefiyetiniz varsa otomatik olarak e-Fatura akışı devreye girer.",
  },
  {
    q: "Birden fazla şirket için kullanabilir miyim?",
    a: "Evet. Aynı hesap üzerinden farklı firma profilleri oluşturarak her birinin verilerini ayrı ayrı yönetebilirsiniz.",
  },
  {
    q: "Mevcut verilerimi içe aktarabilir miyim?",
    a: "Excel ve CSV formatındaki müşteri, ürün ve stok verilerinizi içe aktarabilirsiniz. Daha önce farklı bir program kullandıysanız destek ekibimiz geçiş sürecinde yardımcı olur.",
  },
  {
    q: "Destek kanallarınız neler?",
    a: "E-posta ve telefon üzerinden Türkçe destek sunuyoruz. Tüm destek kanallarına hesapisleri.com üzerinden ulaşılabilir.",
  },
  {
    q: "Mobil cihazlardan kullanabilir miyim?",
    a: "Evet. Hesapişleri.com responsive web paneli olarak tasarlanmıştır; telefon ve tabletten tarayıcı üzerinden tüm modüllere erişebilirsiniz. Ayrı bir uygulama indirmenize gerek yoktur.",
  },
];

const MARKETPLACE_FAQ_ITEM = {
  q: "Trendyol ve Hepsiburada entegrasyonu nasıl çalışıyor?",
  a: "Pazaryeri API entegrasyonları üzerinden siparişler otomatik olarak sisteme düşer, stok güncellenir ve fatura kesilebilir. API anahtarlarınızı girdikten sonra entegrasyon aktif hale gelir.",
};

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: { q: string; a: string };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-white/[0.08] last:border-0">
      <button
        className="flex w-full items-start justify-between gap-4 py-5 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-100">{item.q}</span>
        <svg
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <p className="pb-5 text-sm text-slate-400 leading-relaxed">{item.a}</p>
      )}
    </div>
  );
}

type FaqSectionProps = {
  marketplaceFeatureEnabled?: boolean;
};

export function FaqSection({
  marketplaceFeatureEnabled = false,
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = marketplaceFeatureEnabled
    ? [
        ...CORE_FAQ_ITEMS.slice(0, 5),
        MARKETPLACE_FAQ_ITEM,
        ...CORE_FAQ_ITEMS.slice(5),
      ]
    : CORE_FAQ_ITEMS;

  return (
    <section id="sss" className="bg-[#07162D] py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
            SSS
          </p>
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Sıkça sorulan sorular
          </h2>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 sm:px-6">
          {items.map((item, index) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openIndex === index}
              onToggle={() =>
                setOpenIndex((prev) => (prev === index ? null : index))
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
