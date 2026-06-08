"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  loadingPresets,
  type LoadingPreset,
} from "@/lib/loading-presets";
import { cn } from "@/lib/utils";

export type AppLoadingScreenProps = {
  /** Hazır sayfa metinleri: dashboard, sales, login... */
  preset?: LoadingPreset;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  className?: string;
};

export function AppLoadingScreen({
  preset = "default",
  title,
  subtitle,
  showLogo = true,
  className,
}: AppLoadingScreenProps) {
  const presetConfig = loadingPresets[preset];
  const finalTitle = title ?? presetConfig.title;
  const finalSubtitle = subtitle ?? presetConfig.subtitle;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed inset-0 z-100 flex items-center justify-center bg-[#f7f8ff]/90 px-6 backdrop-blur-sm",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={finalTitle}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-xs flex-col items-center text-center"
      >
        {showLogo ? (
          <img
            src="/logo.svg"
            alt="Hesapişleri"
            className="mb-5 h-9 w-auto object-contain"
          />
        ) : null}

        <Loader2 className="size-8 animate-spin text-blue-600" />

        <p className="mt-5 text-base font-semibold text-slate-900">
          {finalTitle}
        </p>
        {finalSubtitle ? (
          <p className="mt-1.5 text-sm text-slate-500">{finalSubtitle}</p>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
