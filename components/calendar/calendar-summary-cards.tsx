"use client";

import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Wallet,
} from "lucide-react";

type CalendarSummaryCardsProps = {
  todayCount: number;
  weekCount: number;
  overdueCount: number;
  upcomingPaymentCount: number;
};

const cards = [
  {
    key: "today",
    title: "Bugünkü Etkinlikler",
    subtitle: "Bugün planlanan kayıtlar",
    icon: Calendar,
    color: "bg-blue-50 text-blue-600",
    valueKey: "todayCount" as const,
  },
  {
    key: "week",
    title: "Bu Hafta",
    subtitle: "Haftalık toplam etkinlik",
    icon: CalendarClock,
    color: "bg-violet-50 text-violet-600",
    valueKey: "weekCount" as const,
  },
  {
    key: "overdue",
    title: "Gecikmiş İşlemler",
    subtitle: "Aksiyon gerektiren kayıtlar",
    icon: AlertTriangle,
    color: "bg-rose-50 text-rose-500",
    valueKey: "overdueCount" as const,
  },
  {
    key: "payments",
    title: "Yaklaşan Ödemeler",
    subtitle: "Ödeme ve tahsilat vadeleri",
    icon: Wallet,
    color: "bg-amber-50 text-amber-600",
    valueKey: "upcomingPaymentCount" as const,
  },
];

export function CalendarSummaryCards(props: CalendarSummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = props[card.valueKey];

        return (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-[#24345f]/80">
                  {card.title}
                </p>
                <p
                  className={[
                    "mt-2 text-[18px] font-black tracking-[-0.03em]",
                    card.key === "overdue" && value > 0
                      ? "text-rose-600"
                      : "text-[#0f1f4d]",
                  ].join(" ")}
                >
                  {value}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  {card.subtitle}
                </p>
              </div>
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  card.color,
                ].join(" ")}
              >
                <Icon size={18} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
