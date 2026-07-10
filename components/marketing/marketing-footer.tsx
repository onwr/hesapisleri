import Link from "next/link";
import Image from "next/image";
import { PRIVACY_POLICY_PATH } from "@/lib/legal/privacy-policy";

type Props = {
  brandName: string;
  supportEmail: string;
  supportPhone: string | null;
  websiteUrl: string;
};

const FOOTER_COLS = [
  {
    title: "Ürün",
    links: [
      { label: "Özellikler", href: "#ozellikler" },
      { label: "Modüller", href: "#moduller" },
      { label: "Fiyatlandırma", href: "#fiyatlar" },
      { label: "SSS", href: "#sss" },
    ],
  },
  {
    title: "Entegrasyonlar",
    links: [
      { label: "Pazaryeri Entegrasyonları", href: "#entegrasyonlar" },
      { label: "e-Fatura & e-Arşiv", href: "#entegrasyonlar" },
      { label: "Ödeme Sistemleri", href: "#entegrasyonlar" },
    ],
  },
  {
    title: "Hesap",
    links: [
      { label: "Giriş Yap", href: "/login" },
      { label: "Kayıt Ol", href: "/register" },
    ],
  },
  {
    title: "Yasal",
    links: [
      { label: "KVKK Aydınlatma Metni", href: "/kvkk-aydinlatma-metni" },
      { label: "Gizlilik Politikası", href: PRIVACY_POLICY_PATH },
    ],
  },
];

export function MarketingFooter({ brandName, supportEmail, supportPhone, websiteUrl }: Props) {
  const year = new Date().getFullYear();
  const domain = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <footer className="bg-[#07162D] border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label={`${brandName} — Ana sayfa`}
              className="inline-flex items-center gap-2.5 mb-5"
            >
              <Image
                src="/logo.svg"
                alt=""
                width={130}
                height={32}
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-xs">
              KOBİ&apos;ler için geliştirilmiş kapsamlı işletme yönetim platformu.
              Satış, stok, fatura ve daha fazlası tek yerde.
            </p>
            <div className="space-y-2">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {supportEmail}
              </a>
              {supportPhone && (
                <a
                  href={`tel:${supportPhone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {supportPhone}
                </a>
              )}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            © {year} {domain.toUpperCase()} | TAMPAZAR ELEKTRONİK TİCARET SANAYİ LTD. ŞTİ.
          </p>
          <p className="text-xs text-slate-600">
            Türkiye&apos;de geliştirildi · Veri gizliliği odaklı
          </p>
        </div>
      </div>
    </footer>
  );
}
