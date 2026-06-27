const ROWS = [
  { feature: "Tek panelden yönetim",          us: true,  old: false },
  { feature: "Güncel satış ve stok görünümü", us: true,  old: false },
  { feature: "Çoklu firma desteği",           us: true,  old: false },
  { feature: "Rol bazlı yetkilendirme",       us: true,  old: false },
  { feature: "Pazaryeri sipariş yönetimi",    us: true,  old: false },
  { feature: "Finansal raporlama",            us: true,  old: "Kısıtlı" },
  { feature: "Mobil uyumlu arayüz",           us: true,  old: "Kısıtlı" },
  { feature: "Aktivite ve işlem geçmişi",     us: true,  old: false },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === true)
    return (
      <svg className="mx-auto h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  if (val === false)
    return (
      <svg className="mx-auto h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  return <span className="text-xs text-amber-600 font-medium">{val}</span>;
}

export function ComparisonSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-12 items-start lg:grid-cols-[1fr_1.4fr]">
          {/* Left */}
          <div className="lg:pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
              NEDEN HESAPIŞLERİ.COM?
            </p>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl leading-tight">
              İşletme yönetiminde eski yöntemlerin önüne geçin
            </h2>
            <p className="mt-5 text-slate-500 leading-relaxed">
              Dağınık dosyalar ve birbirinden kopuk uygulamalar yerine, tüm süreçlerinizi
              tek merkezde yönetin. Gerçek zamanlı görünürlük, rol bazlı erişim ve entegre
              raporlama ile işletmenizi daha kontrollü büyütün.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {[
                "Satış, stok ve faturayı tek ekranda görün",
                "Ekip üyelerinize rol bazlı erişim verin",
                "Pazaryeri siparişlerini otomatik senkronize edin",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm" aria-label="Özellik karşılaştırması">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-1/2">Özellik</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-blue-700 bg-blue-50 w-1/4">
                    Hesapişleri.com
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 w-1/4">
                    Dağınık / Klasik
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "" : "bg-slate-50/50"}>
                    <td className="px-4 py-3 text-slate-700 text-sm">{row.feature}</td>
                    <td className="px-4 py-3 text-center bg-blue-50/30">
                      <Cell val={row.us} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Cell val={row.old} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
