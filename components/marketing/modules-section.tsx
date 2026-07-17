import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";

const CORE_MODULES = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "blue",
    title: "Finans Yönetimi",
    desc: "Gelir, gider, banka hesapları ve kasa hareketlerini tek ekranda görün. Çek/senet portföyü ve dövizli işlem desteği.",
    features: ["Kasa ve banka takibi", "Çek & senet portföyü", "Nakit akışı görünümü", "Dövizli işlemler"],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: "teal",
    title: "POS / Hızlı Satış",
    desc: "Barkodla ürün ekleyin, nakit veya kart tahsil edin, fiş kesip stok ve kasayı anında güncelleyin.",
    features: ["Barkod ile satış", "Nakit / kart / parçalı ödeme", "Anında stok düşümü", "Kasa hareketi"],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
    color: "violet",
    title: "Stok & Depo",
    desc: "Çoklu depo, renk/beden/ebat varyantları ve otomatik kritik stok uyarılarıyla ürün envanterinizi kontrol altında tutun.",
    features: ["Çoklu depo ve transfer", "Renk/beden varyantları", "Barkod ve QR okuma", "Kritik stok bildirimleri"],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    color: "emerald",
    title: "e-Fatura & e-Arşiv",
    desc: "e-Fatura / e-Arşiv entegrasyonu ile belgelerinizi oluşturun ve gönderin. Sovos / Efaturam bağlantısı ve belge arşivleme desteği.",
    features: ["e-Fatura & e-Arşiv", "e-SMM & müstahsil makbuzu", "Mükellefiyet sorgusu", "Belge arşivleme"],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "cyan",
    title: "Raporlama & Analiz",
    desc: "Günlük satış, nakit/kart tahsilat, kasa durumu ve stok raporlarını tek ekrandan takip edin.",
    features: ["Günlük satış özeti", "Kasa & tahsilat", "En çok satan ürünler", "PDF ve Excel çıktısı"],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    color: "rose",
    title: "Mobil Uyumlu Panel",
    desc: "Telefon, tablet ve masaüstünden tüm işletme verilerinize erişin. Responsive tasarım, tarayıcıdan erişilebilir.",
    features: ["Responsive web paneli", "Telefon ve tablet uyumu", "Tüm modüller erişilebilir", "Tarayıcıdan kullanım"],
  },
];

const MARKETPLACE_MODULE = {
  icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064" />
    </svg>
  ),
  color: "orange",
  title: "Pazaryeri Yönetimi",
  desc: "Trendyol, Hepsiburada, N11 ve ÇiçekSepeti siparişlerini tek panelden yönetin. Stok ve fiyat senkronizasyonu desteklenir.",
  features: ["4 büyük pazaryeri", "Otomatik stok güncellemesi", "Toplu fiyat yönetimi", "Kargo takip entegrasyonu"],
};

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600" },
  teal: { bg: "bg-teal-50", icon: "text-teal-600" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600" },
  orange: { bg: "bg-orange-50", icon: "text-orange-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  cyan: { bg: "bg-cyan-50", icon: "text-cyan-600" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600" },
};

export function ModulesSection() {
  const modules = isMarketplaceFeatureEnabled()
    ? [
        CORE_MODULES[0],
        CORE_MODULES[1],
        CORE_MODULES[2],
        MARKETPLACE_MODULE,
        ...CORE_MODULES.slice(3),
      ]
    : CORE_MODULES;

  return (
    <section id="moduller" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
            TÜM SÜREÇLERİNİZ TEK PLATFORMDA
          </p>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Esnaf için güçlü modüller
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            POS, stok, cari, fatura ve kasa takibini tek merkezden yönetin.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const c = COLOR_MAP[mod.color] ?? COLOR_MAP.blue;
            return (
              <div
                key={mod.title}
                className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.icon} mb-4`}>
                  {mod.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{mod.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{mod.desc}</p>
                <ul className="mt-auto space-y-1.5">
                  {mod.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                      <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
