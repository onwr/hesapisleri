const SECURITY_ITEMS = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Rol Bazlı Yetkilendirme",
    desc: "Her kullanıcıya sadece ihtiyaç duyduğu modüllere erişim yetkisi verin. Sahadaki personelden yönetime kadar ayrı roller.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Güvenli Oturum Yönetimi",
    desc: "Oturum süresi, cihaz takibi ve otomatik oturum kapatma. Şüpheli giriş denemelerine karşı koruma katmanı.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "İşlem ve Aktivite Kayıtları",
    desc: "Kim ne zaman ne yaptı? Tüm işlemler ve değişiklikler kayıt altında. Hesap hareketlerini izleyin ve doğrulayın.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    title: "Bulut Tabanlı Kullanım",
    desc: "Herhangi bir cihazdan tarayıcı üzerinden erişin. Yerel kurulum gerektirmez, veriler bulut altyapısında tutulur.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: "Firma Bazlı Veri İzolasyonu",
    desc: "Her firmanın verileri birbirinden tamamen izole edilmiş alanlarda saklanır. Çoklu firma yönetiminde veri güvenliği.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
    title: "Yedekleme ve Geri Yükleme Süreçleri",
    desc: "Yedekleme ve geri yükleme süreçleri operasyonel olarak planlanır. Veri kaybı riskini azaltmak için altyapı düzeyinde koruma hedeflenir.",
  },
];

export function SecuritySection() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
            GÜVENLİK VE ALTYAPI
          </p>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Verileriniz için güvenli ve kontrollü altyapı
          </h2>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Veri gizliliği odaklı altyapı ile işletmenizin verilerini güvende tutuyoruz.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                {item.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Veri gizliliği odaklı · Türkiye'deki sunucularda barındırılır
        </p>
      </div>
    </section>
  );
}
