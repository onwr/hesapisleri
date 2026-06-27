import Link from "next/link";
import Image from "next/image";

type Props = {
  registrationEnabled: boolean;
  trialDays: number;
  brandName: string;
};

export function HeroSection({ registrationEnabled, trialDays, brandName }: Props) {
  return (
    <section className="relative overflow-hidden bg-[#07162D] pt-20 pb-24 lg:pt-28 lg:pb-32">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 60% -10%, rgba(47,128,255,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 0% 80%, rgba(34,199,242,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 mb-8">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
              </span>
              Türkiye&apos;nin yeni nesil işletme yönetim platformu
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.4rem] leading-[1.08]">
              İşletmenizi tek{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400">
                platformdan
              </span>
              <br />
              yönetin
            </h1>

            <p className="mt-6 text-base text-slate-400 leading-relaxed max-w-lg mx-auto lg:mx-0 sm:text-lg">
              Satış, stok, fatura, kasa ve e-ticaret süreçlerinizi tek merkezden yönetin.{" "}
              <strong className="text-slate-200 font-medium">{brandName}</strong> ile güncel
              verilerle işletmenizi daha hızlı ve kontrollü büyütün.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {registrationEnabled ? (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-0.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {trialDays > 0 ? `${trialDays} Gün Ücretsiz Dene` : "Hemen Başla"}
                  </Link>
                  <a
                    href="#ozellikler"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] px-6 py-3.5 text-base font-semibold text-slate-200 transition-all"
                  >
                    Özellikleri Keşfet
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </a>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-base font-semibold text-white shadow-xl transition-all"
                >
                  Giriş Yap
                </Link>
              )}
            </div>

            {registrationEnabled && trialDays > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                Kredi kartı gerekmez · {trialDays} gün tüm özellikler ücretsiz
              </p>
            )}

            <p className="mt-8 text-xs text-slate-600 lg:mt-12">
              Satıştan raporlamaya tüm süreçler tek panelde.
            </p>
          </div>

          {/* Right: Real panel screenshot */}
          <div className="w-full min-w-0 lg:justify-self-end">
            <div className="relative">
              <div className="overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 bg-[#0B1D3A] px-3 py-2 sm:px-4">
                  <div className="flex gap-1.5 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="ml-2 min-w-0 truncate text-[11px] text-slate-500">
                    Demo Firma A.Ş. — Hesapişleri.com
                  </span>
                  <span className="ml-auto shrink-0 rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                    Demo Ekranı
                  </span>
                </div>

                {/* Screenshot */}
                <div className="relative aspect-[1907/1080] w-full">
                  <Image
                    src="/ekran.png"
                    alt="Hesap İşleri işletme yönetim paneli demo ekranı"
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 760px"
                    className="object-contain object-top"
                  />
                </div>
              </div>

              {/* Glow behind frame */}
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl opacity-30 blur-3xl"
                style={{ background: "linear-gradient(135deg, #2F80FF, #22C7F2)" }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
