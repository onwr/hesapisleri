"use client";

import Link from "next/link";
import { HelpCircle, Menu, Search } from "lucide-react";
import { SUPPORT_URL } from "@/lib/support-config";
import { CalendarTopbarButton } from "@/components/calendar/calendar-modal";
import { NotificationTopbarButton } from "@/components/notifications/notification-topbar-button";
import { AppUserMenu } from "@/components/layout/app-user-menu";
import { sidebarOffsetClass, useSidebar } from "./sidebar-context";

type AppTopbarProps = {
  userName?: string;
  companyName?: string;
};

function getFirstName(name: string) {
  return name.split(" ")[0] || name;
}

function getFormattedDate() {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function AppTopbar({
  userName = "Ahmet Yılmaz",
  companyName = "Örnek Ticaret",
}: AppTopbarProps) {
  const firstName = getFirstName(userName);
  const formattedDate = getFormattedDate();
  const { collapsed, openMobile } = useSidebar();

  return (
    <header
      className={`sticky top-0 z-20 flex h-[76px] items-center border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl transition-[margin] duration-200 lg:px-6 ${sidebarOffsetClass(collapsed)}`}
    >
      <div className="flex w-full items-center justify-between gap-3">
        {/* Mobile hamburger — only visible below lg */}
        <button
          type="button"
          onClick={openMobile}
          aria-label="Menüyü aç"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] shadow-sm transition hover:bg-slate-50 lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none lg:min-w-[220px]">
          <h1 className="truncate text-[13px] font-extrabold leading-tight tracking-[-0.03em] text-[#0f1f4d] md:text-[20px]">
            Hoş geldin, {firstName}! 👋
          </h1>
          <p className="hidden mt-1 text-[13px] font-medium text-slate-500 sm:block">
            Bugün {formattedDate}
          </p>
        </div>

        <div className="hidden w-full max-w-[520px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-100/70 transition focus-within:border-blue-200 focus-within:shadow-blue-100 md:flex">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            placeholder="Ara... müşteri, ürün, fatura"
            className="w-full bg-transparent text-[14px] font-medium text-[#0f1f4d] outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:gap-3">
          <Link
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-[#0f1f4d] shadow-sm shadow-slate-100/70 transition hover:border-blue-100 hover:bg-blue-50/60 hover:text-blue-600 md:flex"
          >
            <HelpCircle size={17} />
            Destek
          </Link>

          <CalendarTopbarButton />
          <NotificationTopbarButton />
          <AppUserMenu userName={userName} companyName={companyName} />
        </div>
      </div>
    </header>
  );
}
