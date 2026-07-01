"use client";

import Link from "next/link";
import { useState } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Sparkles,
  X,
} from "lucide-react";
import { dashboardFadeUp } from "@/components/dashboard/dashboard-motion";
import type { OnboardingChecklistItem } from "@/lib/onboarding/onboarding-progress";

type DashboardStartChecklistProps = {
  items: OnboardingChecklistItem[];
  progressPercent: number;
  canManage?: boolean;
  collapsed?: boolean;
};

export function DashboardStartChecklist({
  items,
  progressPercent,
  canManage = false,
  collapsed: initialCollapsed = false,
}: DashboardStartChecklistProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch("/api/onboarding/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      notifyTenantCacheSync();
    } finally {
      setDismissing(false);
    }
  }

  async function handleReopen() {
    await fetch("/api/onboarding/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    setCollapsed(false);
    notifyTenantCacheSync();
  }

  if (collapsed) {
    return (
      <motion.section variants={dashboardFadeUp}>
        <button
          type="button"
          onClick={() => void handleReopen()}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span className="text-sm font-bold text-[#0f1f4d]">
            Başlangıç Rehberi ({progressPercent}%)
          </span>
          <ChevronDown className="size-4 text-slate-400" />
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section variants={dashboardFadeUp}>
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.035)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[12px] font-black uppercase tracking-wide text-violet-700">
              <Sparkles className="size-3" />
              Başlangıç Rehberi
            </span>
            <p className="mt-2 text-base font-black text-[#0f1f4d] sm:text-lg">
              Hesabınızı adım adım tamamlayın
            </p>
            <p className="mt-1 text-sm text-slate-500">
              İlerleme: %{progressPercent} · {items.filter((i) => i.completed).length}/
              {items.length} tamamlandı
              {canManage ? " · Şirket genelinde görünür" : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              title="Küçült"
            >
              <ChevronUp className="size-4" />
            </button>
            {canManage ? (
              <button
                type="button"
                disabled={dismissing}
                onClick={() => void handleDismiss()}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                title="Başlangıç rehberini şirket için gizle"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-600 to-violet-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50/80"
              >
                {item.completed ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold ${
                      item.completed ? "text-slate-500 line-through" : "text-[#0f1f4d]"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5 text-slate-500">
                    {item.description}
                  </p>
                </div>
                {!item.completed ? (
                  <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        {canManage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-[#0f1f4d] transition hover:bg-slate-50"
            >
              Kurulum sihirbazını aç
            </Link>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
