import Image from "next/image";

export function MobileExperienceSection() {
  return (
    <section className="bg-[#07162D] py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 gap-12 items-center lg:grid-cols-2">
          {/* Left: Copy */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
              MOBİLDE TAM KONTROL
            </p>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl leading-tight">
              İşletmenizi her ekrandan{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                yönetin
              </span>
            </h2>
            <p className="mt-5 text-slate-400 leading-relaxed">
              Telefon, tablet ve masaüstünden işletme verilerinize erişin ve süreçlerinizi
              takip edin. Tarayıcıdan erişilebilen responsive web paneli ile her cihazda
              tam deneyim.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { title: "Responsive tasarım", desc: "320px&apos;den 4K&apos;ya kadar kusursuz görünüm" },
                { title: "Tüm modüller erişilebilir", desc: "Satış, stok, fatura — mobilde de tam işlevsel" },
                { title: "Tarayıcıdan kullanım", desc: "Uygulama indirmenize gerek yok, Chrome veya Safari yeterli" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                    <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                    <p
                      className="text-xs text-slate-500 mt-0.5"
                      dangerouslySetInnerHTML={{ __html: item.desc }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-300">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Mobil uyumlu web paneli
              </span>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="flex items-center justify-center gap-4 relative">
            {/* Ambient */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-20 blur-3xl"
              style={{ background: "radial-gradient(ellipse at center, #2F80FF 0%, transparent 70%)" }}
              aria-hidden="true"
            />

            {/* Phone frame — center (larger) */}
            <div className="relative w-[200px] sm:w-[240px] shrink-0">
              <div className="overflow-hidden rounded-[2rem] border-[5px] border-white/10 bg-[#0B1D3A] shadow-2xl shadow-black/60">
                {/* Status bar */}
                <div className="flex items-center justify-between bg-[#07162D] px-4 py-1.5">
                  <span className="text-[9px] text-slate-400">9:41</span>
                  <div className="flex items-center gap-1">
                    <svg className="h-2.5 w-2.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1.5 8.5C5.4 4.6 10.4 2.5 12 2.5s6.6 2.1 10.5 6M4.5 11.5c2.1-2.1 4.7-3.5 7.5-3.5s5.4 1.4 7.5 3.5M7.5 14.5c1.2-1.2 2.8-2 4.5-2s3.3.8 4.5 2M12 17.5a1 1 0 100 2 1 1 0 000-2z"/>
                    </svg>
                    <svg className="h-3 w-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="2" y="7" width="16" height="10" rx="1.5" ry="1.5"/>
                      <path d="M22 10.5v3a1.5 1.5 0 000-3z"/>
                    </svg>
                  </div>
                </div>
                {/* Screen */}
                <div className="relative aspect-[9/16] w-full overflow-hidden">
                  <Image
                    src="/ekran.png"
                    alt="Hesap İşleri mobil görünümü"
                    fill
                    sizes="240px"
                    className="object-cover object-left-top"
                  />
                </div>
              </div>
              {/* Notch */}
              <div className="absolute top-[calc(1.25rem+2px)] left-1/2 -translate-x-1/2 h-4 w-20 rounded-b-xl bg-[#0B1D3A]" aria-hidden="true" />
            </div>

            {/* Tablet frame — right, partially visible on lg */}
            <div className="hidden sm:block relative w-[280px] max-w-full shrink-0 opacity-70 lg:translate-x-0">
              <div className="overflow-hidden rounded-2xl border-[5px] border-white/10 bg-[#0B1D3A] shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between bg-[#07162D] px-4 py-1.5">
                  <span className="text-[9px] text-slate-400">hesapisleri.com</span>
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </div>
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src="/ekran.png"
                    alt="Hesap İşleri tablet görünümü"
                    fill
                    sizes="280px"
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
