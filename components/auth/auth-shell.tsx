"use client";

import type { ReactNode } from "react";
import { AuthBrandPanel, type AuthBrandVariant } from "@/components/auth/auth-brand-panel";

type AuthShellProps = {
  variant: AuthBrandVariant;
  children: ReactNode;
  maxWidth?: "md" | "lg" | "xl";
};

const maxWidthMap = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

const BRAND_IMAGE_VARIANTS = new Set<AuthBrandVariant>(["login", "register"]);
const WHITE_PANEL_VARIANTS = new Set<AuthBrandVariant>([
  "login",
  "register",
  "onboarding",
]);

export function AuthShell({
  variant,
  children,
  maxWidth = "md",
}: AuthShellProps) {
  const useBrandImage = BRAND_IMAGE_VARIANTS.has(variant);
  const useWhitePanel = WHITE_PANEL_VARIANTS.has(variant);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={[
        "min-h-dvh",
        useWhitePanel ? "bg-white" : "bg-[#f7f8ff]",
      ].join(" ")}
    >
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
        <aside
          className={[
            "relative hidden overflow-hidden lg:flex",
            useBrandImage ? "" : "bg-[#0f1f4d]",
          ].join(" ")}
        >
          {useBrandImage ? (
            <>
              <img
                src="/login-bg.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[#0f1f4d]/60" />
              <div className="absolute inset-0 bg-linear-to-br from-blue-600/25 via-transparent to-violet-600/20" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-linear-to-br from-blue-600/30 via-transparent to-violet-600/25" />
              <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            </>
          )}
          <div className="relative z-10 w-full">
            <AuthBrandPanel variant={variant} />
          </div>
        </aside>

        <section
          className={[
            "flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-16",
            useWhitePanel ? "bg-white" : "",
          ].join(" ")}
        >
          <div className={["mx-auto w-full", maxWidthMap[maxWidth]].join(" ")}>
            {children}
          </div>

          <p className="mx-auto mt-8 max-w-md text-center text-[11px] leading-5 text-slate-400 lg:hidden">
            &copy; {new Date().getFullYear()} HESAPİŞLERİ.COM — TAMPAZAR ELEKTRONİK
            TİCARET SANAYİ LTD. ŞTİ.
          </p>
        </section>
      </div>
    </main>
  );
}

// Re-export type for consumers
export type { AuthBrandVariant };
