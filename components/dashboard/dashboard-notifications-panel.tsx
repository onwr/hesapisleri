"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  hasSafeTenantActionUrl,
  resolveSafeTenantActionUrl,
} from "@/lib/tenant-action-url";
import { AlertTriangle, Bell, Package, ReceiptText } from "lucide-react";

export type DashboardNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type DashboardNotificationsPanelProps = {
  items: DashboardNotificationItem[];
  summary: {
    unread: number;
    critical: number;
    high: number;
  };
};

function getIcon(category: string) {
  if (category === "STOCK") return Package;
  if (category === "FINANCE" || category === "INVOICES") return ReceiptText;
  if (category === "SYSTEM") return AlertTriangle;
  return Bell;
}

function getPriorityClass(priority: string) {
  if (priority === "CRITICAL") return "bg-rose-50 text-rose-600";
  if (priority === "HIGH") return "bg-orange-50 text-orange-600";
  if (priority === "NORMAL") return "bg-blue-50 text-blue-600";
  if (priority === "LOW") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-600";
}

function getPriorityLabel(priority: string) {
  if (priority === "CRITICAL") return "Kritik";
  if (priority === "HIGH") return "Yüksek";
  if (priority === "NORMAL") return "Normal";
  if (priority === "LOW") return "Düşük";
  return priority;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DashboardNotificationsPanel({
  items,
  summary,
}: DashboardNotificationsPanelProps) {
  const router = useRouter();

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // navigation should still work
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      notifyTenantCacheSync();
    } catch {
      // ignore
    }
  }

  async function handleAction(item: DashboardNotificationItem) {
    void markRead(item.id);
    const target = resolveSafeTenantActionUrl(item.actionUrl);
    if (target) {
      router.push(target);
    }
  }

  return (
    <div className="rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Bildirimler ve Aksiyonlar
          </h3>
          <p className="mt-1 text-[12px] font-medium text-slate-500">
            {summary.unread} okunmamış
            {summary.critical > 0 ? ` · ${summary.critical} kritik` : ""}
            {summary.high > 0 ? ` · ${summary.high} yüksek öncelik` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {summary.unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[13px] font-extrabold text-blue-600 transition hover:text-blue-700"
            >
              Tümünü okundu işaretle
            </button>
          ) : null}
          <Link
            href="/notifications"
            className="inline-flex items-center gap-1 text-[13px] font-extrabold text-blue-600 transition hover:text-blue-700"
          >
            Tümünü gör
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Dikkat gerektiren bildirim yok
          </p>
        ) : (
          items.map((item) => {
            const Icon = getIcon(item.category);

            return (
              <div
                key={item.id}
                className={[
                  "rounded-xl border px-3 py-3",
                  item.readAt
                    ? "border-slate-200/70 bg-white"
                    : "border-blue-100 bg-blue-50/40",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-extrabold text-[#0f1f4d]">
                        {item.title}
                      </p>
                      <span
                        className={[
                          "rounded-md px-2 py-0.5 text-[11px] font-black",
                          getPriorityClass(item.priority),
                        ].join(" ")}
                      >
                        {getPriorityLabel(item.priority)}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-[12px] font-medium text-slate-500">
                      {item.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatTime(item.createdAt)}
                      </span>

                      {hasSafeTenantActionUrl(item.actionUrl) ? (
                        <button
                          type="button"
                          onClick={() => void handleAction(item)}
                          className="text-[12px] font-bold text-blue-600 hover:text-blue-700"
                        >
                          Aksiyona git
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
