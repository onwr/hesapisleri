"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Modüller", href: "#moduller" },
  { label: "Entegrasyonlar", href: "#entegrasyonlar" },
  { label: "Fiyatlandırma", href: "#fiyatlar" },
  { label: "SSS", href: "#sss" },
];

function scrollToId(id: string) {
  const el = document.querySelector(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Props = {
  registrationEnabled: boolean;
  trialDays: number;
};

export function MarketingHeader({ registrationEnabled, trialDays }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href.startsWith("#")) {
        e.preventDefault();
        scrollToId(href);
        setMenuOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07162D]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0" aria-label="Ana sayfa">
            <Image
              src="/logo.svg"
              alt="Hesap İşleri"
              width={136}
              height={34}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Ana menü">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Giriş Yap
            </Link>
            {registrationEnabled ? (
              <Link
                href="/register"
                className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-900/40"
              >
                {trialDays > 0 ? "Ücretsiz Dene" : "Kayıt Ol"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Giriş Yap
              </Link>
            )}

            {/* Hamburger */}
            <button
              className="lg:hidden ml-1 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          ref={drawerRef}
          className="lg:hidden border-t border-white/[0.06] bg-[#07162D] px-4 py-3"
          role="dialog"
          aria-label="Mobil menü"
        >
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 pt-2 border-t border-white/[0.06] flex flex-col gap-0.5">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Giriş Yap
              </Link>
              {registrationEnabled && (
                <Link
                  href="/register"
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white text-center transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {trialDays > 0 ? "Ücretsiz Dene" : "Kayıt Ol"}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
