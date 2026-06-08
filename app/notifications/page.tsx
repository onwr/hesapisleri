import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Info,
  MailCheck,
  MoreVertical,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
    title: "Okunmamışlar",
    description: "Yeni bildirimleri görüntüle",
    icon: Bell,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Tümünü Okundu Yap",
    description: "Bildirimleri temizle",
    icon: MailCheck,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    title: "Kritik Uyarılar",
    description: "Önemli uyarıları incele",
    icon: ShieldAlert,
    gradient: "from-orange-400 to-orange-600",
  },
  {
    title: "Bildirim Ayarları",
    description: "Tercihlerini yönet",
    icon: Settings,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    title: "Sistem Mesajları",
    description: "Platform duyuruları",
    icon: Sparkles,
    gradient: "from-rose-400 to-pink-600",
  },
];

const tabs = ["Tümü", "Okunmamış", "Başarılı", "Uyarılar", "Hatalar", "Sistem"];

export default async function NotificationsPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const notifications = await db.notification.findMany({
    where: {
      companyId: company.id,
      OR: [{ userId: payload.userId }, { userId: null }],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const unreadCount = notifications.filter(
    (notification) => !notification.readAt
  ).length;

  const readCount = notifications.length - unreadCount;

  const successCount = notifications.filter(
    (notification) => notification.type === "SUCCESS"
  ).length;

  const warningCount = notifications.filter(
    (notification) => notification.type === "WARNING"
  ).length;

  const errorCount = notifications.filter(
    (notification) => notification.type === "ERROR"
  ).length;

  const infoCount = notifications.filter(
    (notification) => notification.type === "INFO"
  ).length;

  const statCards = [
    {
      title: "Toplam Bildirim",
      value: notifications.length,
      subtitle: `${readCount} okundu`,
      icon: Bell,
      color: "blue",
    },
    {
      title: "Okunmamış",
      value: unreadCount,
      subtitle: "Yeni bildirim",
      icon: Clock,
      color: "orange",
    },
    {
      title: "Başarılı İşlem",
      value: successCount,
      subtitle: "Tamamlanan süreç",
      icon: CheckCircle2,
      color: "emerald",
    },
    {
      title: "Uyarı",
      value: warningCount,
      subtitle: "Dikkat gerektiren",
      icon: AlertCircle,
      color: "orange",
    },
    {
      title: "Hata / Kritik",
      value: errorCount,
      subtitle: "Müdahale gerekli",
      icon: ShieldAlert,
      color: "rose",
    },
  ];

  const colorClassMap = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-500",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-500",
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {actionCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.title}
                type="button"
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
                  className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
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
                {tabs.map((tab, index) => (
                  <button
                    key={tab}
                    type="button"
                    className={[
                      "h-10 min-w-max border-r border-slate-100 px-4 text-[12px] font-extrabold transition last:border-r-0",
                      index === 0
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:w-[260px]">
                  <Search size={16} className="text-slate-400" />
                  <input
                    placeholder="Bildirim ara..."
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50"
                >
                  <Filter size={16} />
                  Filtrele
                  <ChevronDown size={15} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={[
                      "flex gap-4 px-4 py-4 transition hover:bg-slate-50/80",
                      notification.readAt ? "bg-white" : "bg-blue-50/30",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                        getNotificationClass(notification.type),
                      ].join(" ")}
                    >
                      <Icon size={20} strokeWidth={2.4} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-black text-[#0f1f4d]">
                          {notification.title}
                        </p>

                        {!notification.readAt ? (
                          <span className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-black leading-none text-white">
                            Yeni
                          </span>
                        ) : null}

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
                        <span>{formatDate(notification.createdAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>
                          {notification.readAt ? "Okundu" : "Okunmadı"}
                        </span>
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <CheckCircle2 size={15} />
                      </button>

                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                      >
                        <MoreVertical size={15} />
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
                    Satış, fatura, stok ve sistem bildirimleri burada
                    listelenecek.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] font-semibold text-slate-500">
                Toplam {notifications.length} bildirim
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-400"
                >
                  Önceki
                </button>

                {[1, 2, 3, 4].map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-black",
                      page === 1
                        ? "bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-100"
                        : "border border-slate-200 bg-white text-[#24345f] hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-[#24345f] transition hover:bg-slate-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Bildirim Özeti
              </h3>

              <div className="space-y-3">
                <SummaryRow
                  label="Okunmamış"
                  value={unreadCount}
                  icon={<Clock size={15} />}
                  color="orange"
                />

                <SummaryRow
                  label="Başarılı"
                  value={successCount}
                  icon={<CheckCircle2 size={15} />}
                  color="emerald"
                />

                <SummaryRow
                  label="Uyarı"
                  value={warningCount}
                  icon={<AlertCircle size={15} />}
                  color="orange"
                />

                <SummaryRow
                  label="Hata"
                  value={errorCount}
                  icon={<ShieldAlert size={15} />}
                  color="rose"
                />

                <SummaryRow
                  label="Bilgi"
                  value={infoCount}
                  icon={<Info size={15} />}
                  color="blue"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Bildirim Kategorileri
              </h3>

              <div className="space-y-3">
                <CategoryBox
                  title="Satış ve Tahsilat"
                  desc="Yeni satışlar, ödemeler ve tahsilatlar"
                  icon={<CheckCircle2 size={17} />}
                  color="emerald"
                />

                <CategoryBox
                  title="Fatura Süreçleri"
                  desc="e-Fatura, vade ve ödeme durumları"
                  icon={<FileIcon />}
                  color="blue"
                />

                <CategoryBox
                  title="Stok Uyarıları"
                  desc="Düşük stok ve stokta yok bildirimleri"
                  icon={<AlertCircle size={17} />}
                  color="orange"
                />

                <CategoryBox
                  title="Sistem Mesajları"
                  desc="Platform güncellemeleri ve üyelik"
                  icon={<Info size={17} />}
                  color="violet"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-blue-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                <Zap size={20} strokeWidth={2.5} />
              </div>

              <p className="mt-4 text-[14px] font-black text-[#0f1f4d]">
                Akıllı bildirim yönetimi
              </p>

              <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
                Kritik uyarıları öne çıkarabilir, fatura vadesi yaklaşan
                müşteriler için otomatik hatırlatma akışları oluşturabilirsiniz.
              </p>

              <button className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm">
                Bildirim Ayarları
              </button>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "emerald" | "orange" | "rose" | "blue";
};

function SummaryRow({ label, value, icon, color }: SummaryRowProps) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    rose: "bg-rose-50 text-rose-500",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>

      <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#24345f]">
        {label}
      </p>

      <p className="shrink-0 text-[12px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

type CategoryBoxProps = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: "emerald" | "orange" | "blue" | "violet";
};

function CategoryBox({ title, desc, icon, color }: CategoryBoxProps) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[12px] font-black text-[#0f1f4d]">{title}</p>
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-slate-500">
          {desc}
        </p>
      </div>
    </div>
  );
}

function FileIcon() {
  return <Info size={17} />;
}