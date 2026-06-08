"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Sparkles } from "lucide-react";
import { dashboardFadeUp } from "@/components/dashboard/dashboard-motion";

export function DashboardOnboardingAlert() {
  return (
    <motion.section variants={dashboardFadeUp}>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-blue-50/60 to-transparent" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-100">
              <Building2 size={22} strokeWidth={2.2} />
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                <Sparkles size={12} />
                Kurulum önerisi
              </span>
              <p className="mt-3 text-lg font-black tracking-tight text-[#0f1f4d] sm:text-xl">
                Firma bilgilerinizi tamamlayın
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Logo, iletişim ve varsayılan ayarları birkaç adımda tamamlayın.
                Satış, fatura ve ekip yönetimi için paneliniz hazır hale gelsin.
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                Vergi no ve vergi dairesi opsiyoneldir; istediğiniz zaman
                ayarlardan ekleyebilirsiniz.
              </p>
            </div>
          </div>

          <Link
            href="/onboarding"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95 lg:self-center"
          >
            Kurulumu Tamamla
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
