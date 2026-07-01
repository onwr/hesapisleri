"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Info,
  Loader2,
  MailCheck,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY_LABELS,
  type NormalizedNotification,
  type NotificationSummary,
  type NotificationTab,
} from "@/lib/notification-utils";
import { formatDateTimeDisplay } from "@/lib/format-utils";
import {
  hasSafeTenantActionUrl,
  resolveSafeTenantActionUrl,
} from "@/lib/tenant-action-url";

function getNotificationIcon(type: string) {
  if (type === "SUCCESS") return CheckCircle2;
  if (type === "WARNING") return AlertCircle;
  if (type === "ERROR") return ShieldAlert;
  return Info;
}

function getNotificationClass(type: string) {
  if (type === "SUCCESS") return "bg-emerald-50 text-emerald-600";
  if (type === "WARNING") return "bg-orange-50 text-orange-500";
  if (type === "ERROR") return "bg-rose-50 text-rose-500";
  return "bg-blue-50 text-blue-600";
}

function getNotificationBadge(type: string) {
  if (type === "SUCCESS") return "bg-emerald-100 text-emerald-700";
  if (type === "WARNING") return "bg-orange-100 text-orange-700";
  if (type === "ERROR") return "bg-rose-100 text-rose-700";
  return "bg-blue-100 text-blue-700";
}

function getNotificationText(type: string) {
  if (type === "SUCCESS") return "Başarılı";
  if (type === "WARNING") return "Uyarı";
  if (type === "ERROR") return "Hata";
  return "Bilgi";
}

const actionCards = [
  {
    key: "unread",
    title: "Okunmamışlar",
    description: "Yeni bildirimleri görüntüle",
    icon: Bell,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    key: "read-all",
    title: "Tümünü Okundu Yap",
    description: "Bildirimleri temizle",
    icon: MailCheck,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    key: "critical",
    title: "Kritik Uyarılar",
    description: "Önemli uyarıları incele",
    icon: ShieldAlert,
    gradient: "from-orange-400 to-orange-600",
  },
  {
    key: "settings",
    title: "Bildirim Ayarları",
    description: "Tercihlerini yönet",
    icon: Settings,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    key: "system",
    title: "Sistem Mesajları",
    description: "Platform duyuruları",
    icon: Sparkles,
    gradient: "from-rose-400 to-pink-600",
  },
] as const;

const tabs: Array<{ key: NotificationTab; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "unread", label: "Okunmamış" },
  { key: "read", label: "Okunmuş" },
];

export function NotificationsPageClient() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NormalizedNotification[]>(
    []
  );
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadNotifications = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          tab,
          limit: "20",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (category) params.set("category", category);
        if (priority) params.set("priority", priority);
        if (cursor) params.set("cursor", cursor);

        const [listRes, summaryRes] = await Promise.all([
          fetch(`/api/notifications?${params.toString()}`),
          fetch("/api/notifications/summary"),
        ]);

        const listJson = await listRes.json();
        const summaryJson = await summaryRes.json();

        if (listRes.ok && listJson.success) {
          setNotifications((prev) =>
            append
              ? [...prev, ...(listJson.notifications ?? [])]
              : (listJson.notifications ?? [])
          );
          setNextCursor(listJson.nextCursor ?? null);
        }

        if (summaryRes.ok && summaryJson.success) {
          setSummary(summaryJson.summary ?? null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, debouncedSearch, category, priority]
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const statCards = useMemo(() => {
    const successCount = notifications.filter((n) => n.type === "SUCCESS").length;
    const warningCount = notifications.filter((n) => n.type === "WARNING").length;
    const errorCount = notifications.filter((n) => n.type === "ERROR").length;

    return [
      {
        title: "Toplam Bildirim",
        value: summary
          ? summary.byCategory.reduce((sum, item) => sum + item.count, 0)
          : notifications.length,
        subtitle: `${summary?.unread ?? 0} okunmamış`,
        icon: Bell,
        color: "blue",
      },
      {
        title: "Okunmamış",
        value: summary?.unread ?? 0,
        subtitle: "Yeni bildirim",
        icon: Clock,
        color: "orange",
      },
      {
        title: "Bugün",
        value: summary?.today ?? 0,
        subtitle: "Son 24 saat",
        icon: CheckCircle2,
        color: "emerald",
      },
      {
        title: "Kritik",
        value: summary?.critical ?? 0,
        subtitle: "Acil müdahale",
        icon: ShieldAlert,
        color: "rose",
      },
      {
        title: "Yüksek Öncelik",
        value: summary?.high ?? 0,
        subtitle: "Önemli kayıtlar",
        icon: AlertCircle,
        color: "orange",
      },
    ];
  }, [notifications, summary]);

  const colorClassMap = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-500",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-500",
  };

  async function handleMarkRead(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item
          )
        );
        void loadNotifications();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
    const json = await res.json();
    if (res.ok && json.success) {
      void loadNotifications();
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
        void loadNotifications();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpen(notification: NormalizedNotification) {
    if (!notification.isRead) {
      await handleMarkRead(notification.id);
    }
    const target = resolveSafeTenantActionUrl(notification.actionUrl);
    if (target) {
      router.push(target);
    }
  }

  function handleActionCard(key: (typeof actionCards)[number]["key"]) {
    if (key === "unread") {
      setTab("unread");
      return;
    }
    if (key === "read-all") {
      void handleMarkAllRead();
      return;
    }
    if (key === "critical") {
      setPriority("CRITICAL");
      setTab("all");
      return;
    }
    if (key === "system") {
      setCategory("SYSTEM");
      setTab("all");
      return;
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {actionCards.map((card) => {
          const Icon = card.icon;
          const isSettings = card.key === "settings";

          if (isSettings) {
            return (
              <Link
                key={card.key}
                href="/settings"
                className={[
                  "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                  card.gradient,
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                    <Icon size={22} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-black leading-tight">
                      {card.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                      {card.description}
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} strokeWidth={3} className="shrink-0 opacity-90" />
              </Link>
            );
          }

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleActionCard(card.key)}
              className={[
                "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                card.gradient,
              ].join(" ")}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                  <Icon size={22} strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black leading-tight">
                    {card.title}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                    {card.description}
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                strokeWidth={3}
                className="shrink-0 opacity-90 transition group-hover:translate-x-1"
              />
            </button>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {stat.title}
                  </p>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    colorClassMap[stat.color as keyof typeof colorClassMap],
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </div>
              </div>
              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                {stat.subtitle}
              </p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={[
                    "h-10 min-w-max border-r border-slate-100 px-4 text-[12px] font-extrabold transition last:border-r-0",
                    tab === item.key
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:w-[260px]">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Bildirim ara..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <Filter size={16} />
                Filtrele
                <ChevronDown size={15} className="text-slate-400" />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-[#0f1f4d]"
              >
                <option value="">Tüm kategoriler</option>
                {NOTIFICATION_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {NOTIFICATION_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-[#0f1f4d]"
              >
                <option value="">Tüm öncelikler</option>
                {NOTIFICATION_PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {NOTIFICATION_PRIORITY_LABELS[item]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setCategory("");
                  setPriority("");
                }}
                className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-bold text-slate-500 hover:bg-slate-50"
              >
                Filtreleri temizle
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const isBusy = busyId === notification.id;

                return (
                  <div
                    key={notification.id}
                    className={[
                      "flex gap-4 px-4 py-4 transition hover:bg-slate-50/80",
                      notification.isRead ? "bg-white" : "bg-blue-50/30",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => void handleOpen(notification)}
                      className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    >
                      <div
                        className={[
                          "flex h-11 w-11 items-center justify-center rounded-2xl",
                          getNotificationClass(notification.type),
                        ].join(" ")}
                      >
                        <Icon size={20} strokeWidth={2.4} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleOpen(notification)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-black text-[#0f1f4d]">
                          {notification.title}
                        </p>
                        {!notification.isRead ? (
                          <span className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-black leading-none text-white">
                            Yeni
                          </span>
                        ) : null}
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black leading-none text-slate-600">
                          {NOTIFICATION_CATEGORY_LABELS[notification.category]}
                        </span>
                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black leading-none",
                            getNotificationBadge(notification.type),
                          ].join(" ")}
                        >
                          {getNotificationText(notification.type)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-5 text-slate-500">
                        {notification.message}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-400">
                        <span>{formatDateTimeDisplay(notification.createdAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{notification.isRead ? "Okundu" : "Okunmadı"}</span>
                      </div>
                    </button>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      {!notification.isRead ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleMarkRead(notification.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                          title="Okundu işaretle"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDelete(notification.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-rose-50 hover:text-rose-500"
                        title="Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {notifications.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                    <Bell size={28} />
                  </div>
                  <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                    Henüz bildirim yok
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Satış, fatura, stok ve sistem bildirimleri burada listelenecek.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] font-semibold text-slate-500">
              {notifications.length} bildirim gösteriliyor
            </p>
            {nextCursor ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadNotifications(nextCursor, true)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? "Yükleniyor..." : "Daha fazla yükle"}
              </button>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <h3 className="text-[12px] font-black uppercase tracking-wide text-slate-400">
              Kategoriler
            </h3>
            <div className="mt-3 space-y-2">
              {(summary?.byCategory ?? []).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setCategory(item.category)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-left text-[12px] font-semibold text-[#0f1f4d] hover:bg-slate-50"
                >
                  <span>{NOTIFICATION_CATEGORY_LABELS[item.category]}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
