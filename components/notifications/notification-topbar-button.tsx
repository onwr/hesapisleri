"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  formatUnreadBadge,
  type NormalizedNotification,
} from "@/lib/notification-utils";
import {
  hasSafeTenantActionUrl,
  resolveSafeTenantActionUrl,
} from "@/lib/tenant-action-url";

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DropdownItem({
  notification,
  onOpen,
  onDelete,
}: {
  notification: NormalizedNotification;
  onOpen: (notification: NormalizedNotification) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={[
        "group flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition",
        notification.isRead
          ? "border-slate-100 bg-white hover:bg-slate-50"
          : "border-blue-100/80 bg-blue-50/40 hover:bg-blue-50/70",
      ].join(" ")}
    >
      <div className="mt-1.5 shrink-0">
        {!notification.isRead ? (
          <span className="block size-2 rounded-full bg-blue-600" />
        ) : (
          <span className="block size-2 rounded-full bg-slate-200" />
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-black text-[#0f1f4d]">
            {notification.title}
          </span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
            {NOTIFICATION_CATEGORY_LABELS[notification.category]}
          </span>
          {notification.priority === "HIGH" ||
          notification.priority === "CRITICAL" ? (
            <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">
              {NOTIFICATION_PRIORITY_LABELS[notification.priority]}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </button>

      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
        {hasSafeTenantActionUrl(notification.actionUrl) ? (
          <button
            type="button"
            onClick={() => onOpen(notification)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
            title="Aç"
          >
            <ExternalLink size={13} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          title="Sil"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function NotificationTopbarButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [notifications, setNotifications] = useState<NormalizedNotification[]>(
    []
  );
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      const json = await res.json();
      if (res.ok && json.success) {
        setUnreadCount(json.count ?? 0);
      }
    } finally {
      setLoadingCount(false);
    }
  }, []);

  const loadRecentNotifications = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        tab: "all",
        limit: "8",
      });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.notifications ?? []);
        if (json.summary?.unread != null) {
          setUnreadCount(json.summary.unread);
        }
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 45000);
    return () => window.clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void loadRecentNotifications();
  }, [open, loadRecentNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleOpenNotification(notification: NormalizedNotification) {
    if (!notification.isRead) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
    }

    setOpen(false);

    const target = resolveSafeTenantActionUrl(notification.actionUrl);
    if (target) {
      router.push(target);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      const json = await res.json();
      if (res.ok && json.success) {
        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((item) => ({
            ...item,
            isRead: true,
            readAt: item.readAt ?? new Date().toISOString(),
          }))
        );
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.success) {
      setNotifications((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target && !target.isRead) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((item) => item.id !== id);
      });
    }
  }

  const badge = formatUnreadBadge(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f1f4d] shadow-sm shadow-slate-100/70 transition hover:border-blue-100 hover:bg-blue-50/60 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
        aria-label="Bildirimleri aç"
        aria-expanded={open}
      >
        <Bell size={18} />
        {!loadingCount && badge ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,31,77,0.18)]">
          <div className="border-b border-slate-100 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black">Bildirimler</h2>
                <p className="mt-0.5 text-[13px] text-blue-100/85">
                  {unreadCount > 0
                    ? `${unreadCount} okunmamış bildirim`
                    : "Tüm bildirimler okundu"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={markingAll || unreadCount === 0}
                className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-bold transition hover:bg-white/15 disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCheck size={12} />
                )}
                Tümünü okundu yap
              </button>
            </div>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-3">
            {loadingList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <Bell className="mx-auto text-slate-300" size={28} />
                <p className="mt-3 text-sm font-bold text-[#0f1f4d]">
                  Yeni bildiriminiz yok.
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Satış, fatura ve sistem bildirimleri burada görünür.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.slice(0, 8).map((notification) => (
                  <DropdownItem
                    key={notification.id}
                    notification={notification}
                    onOpen={(item) => void handleOpenNotification(item)}
                    onDelete={(id) => void handleDelete(id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <Button asChild className="h-10 w-full rounded-xl">
              <Link href="/notifications" onClick={() => setOpen(false)}>
                Tümünü gör
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
