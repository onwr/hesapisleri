import Link from "next/link";
import type { PublicPlan } from "@/lib/marketing/public-plan-service";

type Props = {
  plans: PublicPlan[];
  registrationEnabled: boolean;
};

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minor);
}

function CheckIcon({ accent }: { accent?: boolean }) {
  return (
    <svg
      className={`mt-0.5 h-[15px] w-[15px] shrink-0 ${accent ? "text-blue-200" : "text-blue-500"}`}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
    </svg>
  );
}

function FeaturedCard({
  plan,
  registrationEnabled,
}: {
  plan: PublicPlan;
  registrationEnabled: boolean;
}) {
  const monthlyEq =
    plan.yearlyPrice > 0 ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative flex justify-center pt-5 pb-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-1 text-[11px] font-bold text-white">
          <svg className="h-3 w-3 fill-white" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          En Popüler
        </span>
      </div>

      <div className="relative flex flex-col flex-1 p-7">
        <div className="mb-6">
          <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
          {plan.shortDescription && (
            <p className="mt-1.5 text-sm text-blue-200/80 leading-relaxed">{plan.shortDescription}</p>
          )}
        </div>

        <div className="mb-7">
          {plan.monthlyPrice > 0 ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-white leading-none">
                  {formatPrice(plan.monthlyPrice, plan.currency)}
                </span>
                <span className="text-blue-300 text-base mb-1">/ay</span>
              </div>
              {plan.yearlyPrice > 0 && plan.yearlyPrice < plan.monthlyPrice * 12 && (
                <p className="text-blue-300 text-xs mt-2">
                  Yıllık ödeyince {formatPrice(monthlyEq, plan.currency)}/ay
                </p>
              )}
            </>
          ) : (
            <p className="text-3xl font-extrabold text-white">İletişime Geçin</p>
          )}
        </div>

        {registrationEnabled ? (
          <Link
            href="/register"
            className="block w-full rounded-xl bg-white py-3.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors mb-7"
          >
            {plan.trialEnabled && plan.trialDays > 0
              ? `${plan.trialDays} Gün Ücretsiz Dene`
              : "Hemen Başla"}
          </Link>
        ) : (
          <Link
            href="/login"
            className="block w-full rounded-xl bg-white py-3.5 text-center text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors mb-7"
          >
            Giriş Yap
          </Link>
        )}

        {plan.features.length > 0 && (
          <>
            <div className="border-t border-white/15 mb-5" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-4">Neler dahil</p>
            <ul className="space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckIcon accent />
                  <span className="text-sm text-blue-100 leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function StandardCard({
  plan,
  registrationEnabled,
}: {
  plan: PublicPlan;
  registrationEnabled: boolean;
}) {
  const monthlyEq =
    plan.yearlyPrice > 0 ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 h-full shadow-sm hover:shadow-md transition-shadow">
      {plan.badgeText && (
        <span className="mb-4 inline-block self-start rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700">
          {plan.badgeText}
        </span>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
        {plan.shortDescription && (
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{plan.shortDescription}</p>
        )}
      </div>

      <div className="mb-7">
        {plan.monthlyPrice > 0 ? (
          <>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900 leading-none">
                {formatPrice(plan.monthlyPrice, plan.currency)}
              </span>
              <span className="text-slate-400 text-base mb-1">/ay</span>
            </div>
            {plan.yearlyPrice > 0 && plan.yearlyPrice < plan.monthlyPrice * 12 && (
              <p className="text-slate-400 text-xs mt-2">
                Yıllık ödeyince {formatPrice(monthlyEq, plan.currency)}/ay
              </p>
            )}
          </>
        ) : (
          <p className="text-3xl font-extrabold text-slate-900">İletişime Geçin</p>
        )}
      </div>

      {registrationEnabled ? (
        <Link
          href="/register"
          className="block w-full rounded-xl bg-slate-900 py-3.5 text-center text-sm font-bold text-white hover:bg-slate-700 transition-colors mb-7"
        >
          {plan.trialEnabled && plan.trialDays > 0
            ? `${plan.trialDays} Gün Ücretsiz Dene`
            : "Hemen Başla"}
        </Link>
      ) : (
        <Link
          href="/login"
          className="block w-full rounded-xl border border-slate-200 py-3.5 text-center text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors mb-7"
        >
          Giriş Yap
        </Link>
      )}

      {plan.features.length > 0 && (
        <>
          <div className="border-t border-slate-100 mb-5" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Neler dahil</p>
          <ul className="space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-sm text-slate-600 leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function PricingSection({ plans, registrationEnabled }: Props) {
  return (
    <section id="fiyatlar" className="relative bg-slate-50 py-28 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">
            Fiyatlandırma
          </p>
          <h2 className="text-4xl font-extrabold text-slate-900 sm:text-5xl tracking-tight">
            İşletmenize uygun plan
          </h2>
          <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
            Tüm planlarda temel modüller dahildir. İhtiyacınıza göre ölçeklendirin.
          </p>
        </div>

        {plans.length > 0 ? (
          <>
            <div
              className={`grid gap-5 items-stretch ${
                plans.length === 1
                  ? "max-w-sm mx-auto"
                  : plans.length === 2
                  ? "sm:grid-cols-2 max-w-3xl mx-auto"
                  : "sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {plans.map((plan) =>
                plan.isFeatured ? (
                  <FeaturedCard key={plan.id} plan={plan} registrationEnabled={registrationEnabled} />
                ) : (
                  <StandardCard key={plan.id} plan={plan} registrationEnabled={registrationEnabled} />
                )
              )}
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {[
                { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", label: "Kredi kartı gerektirmez" },
                { icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "İstediğiniz zaman iptal edin" },
                { icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z", label: "Fiyatlar KDV hariçtir" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                  {label}
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Özel teklif için{" "}
              <a href="#iletisim" className="text-blue-600 hover:text-blue-500 underline underline-offset-2">
                iletişime geçin
              </a>
            </p>
          </>
        ) : (
          <div className="max-w-lg mx-auto rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 mx-auto mb-5">
              <svg className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3">Fiyat için iletişime geçin</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              İşletmenizin ihtiyaçlarına özel bir teklif almak için bize ulaşın.
            </p>
            {registrationEnabled && (
              <Link
                href="/register"
                className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 px-8 py-3.5 text-sm font-bold text-white transition-colors"
              >
                Ücretsiz Denemeyi Başlat
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
