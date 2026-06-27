import Link from "next/link";

type Props = {
  registrationEnabled: boolean;
  trialDays: number;
};

export function FinalCtaSection({ registrationEnabled, trialDays }: Props) {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          İşletmenizi tek panelden yönetmeye{" "}
          <span className="text-blue-600">başlayın</span>
        </h2>
        <p className="mt-4 text-lg text-slate-500 leading-relaxed max-w-xl mx-auto">
          {trialDays > 0 ? (
            <>
              {trialDays} günlük ücretsiz deneme ile başlayın. Kurulum gerekmez, kredi kartı
              sorulmaz.
            </>
          ) : (
            <>
              Satış, stok, finans ve operasyon süreçlerinizi daha kolay takip edin.
            </>
          )}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          {registrationEnabled ? (
            <>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {trialDays > 0 ? `${trialDays} Gün Ücretsiz Başla` : "Hemen Başla"}
              </Link>
              <a
                href="#fiyatlar"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-8 py-4 text-base font-semibold text-slate-700 transition-all shadow-sm"
              >
                Paketleri İncele
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all"
            >
              Giriş Yap
            </Link>
          )}
        </div>

        {registrationEnabled && trialDays > 0 && (
          <p className="mt-4 text-xs text-slate-400">
            Kredi kartı gerekmez · {trialDays} gün tüm özellikler ücretsiz
          </p>
        )}
      </div>
    </section>
  );
}
