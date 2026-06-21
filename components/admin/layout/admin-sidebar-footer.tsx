"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAdminSidebar } from "./admin-sidebar-context";
import { appNavInactiveClass } from "@/lib/admin-ui";

type AdminSidebarFooterProps = {
  userName: string;
  userEmail: string;
  firmPanelHref: string;
};

export function AdminSidebarFooter({
  userName,
  userEmail,
  firmPanelHref,
}: AdminSidebarFooterProps) {
  const { collapsed } = useAdminSidebar();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const actionClass = [
    "flex items-center rounded-2xl text-[12px] font-bold transition-all duration-200",
    appNavInactiveClass,
    collapsed ? "justify-center px-0 py-2.5" : "gap-2 px-3.5 py-2",
  ].join(" ");

  return (
    <div className="shrink-0 border-t border-slate-200/70 p-3">
      {!collapsed ? (
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12px] font-black text-blue-600">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-[#0f1f4d]">{userName}</p>
            <p className="truncate text-[10px] text-slate-500">{userEmail}</p>
          </div>
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700">
            Super Admin
          </span>
        </div>
      ) : null}

      <div className="space-y-0.5">
        <Link
          href={firmPanelHref}
          className={actionClass}
          title={collapsed ? "Firma Paneline Dön" : undefined}
        >
          <ArrowLeft size={16} />
          {!collapsed ? "Firma Paneline Dön" : null}
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={actionClass}
          title={collapsed ? "Çıkış Yap" : undefined}
        >
          <LogOut size={16} />
          {!collapsed ? "Çıkış Yap" : null}
        </button>
      </div>
    </div>
  );
}
