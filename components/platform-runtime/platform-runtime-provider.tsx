"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicPlatformRuntimeConfig } from "@/lib/platform-runtime/platform-runtime-types";
import { getPublicPlatformRuntimeConfigFallback } from "@/lib/platform-runtime/platform-runtime-fallback";

const PlatformRuntimeContext = createContext<PublicPlatformRuntimeConfig | null>(null);

export function PlatformRuntimeProvider({
  config,
  children,
}: {
  config: PublicPlatformRuntimeConfig;
  children: ReactNode;
}) {
  return (
    <PlatformRuntimeContext.Provider value={config}>
      {children}
    </PlatformRuntimeContext.Provider>
  );
}

export function usePlatformRuntime() {
  const context = useContext(PlatformRuntimeContext);
  return context ?? getPublicPlatformRuntimeConfigFallback();
}

export function usePlatformUploadLimits() {
  const runtime = usePlatformRuntime();
  return {
    maxImageBytes: runtime.maxImageBytes,
    maxTaxCertificateBytes: runtime.maxTaxCertificateBytes,
  };
}
