"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getSidebarMenuItems } from "@/lib/sidebar-menu";
import type { PermissionRole } from "@/lib/permission-utils";
import { useSidebar } from "./sidebar-context";

type AppSidebarProps = {
  userName: string;
  companyName: string;
  companyRole?: string;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
};

export function AppSidebar({
  companyRole = "STAFF",
  isSuperAdmin = false,
  isOwner = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const menuItems = getSidebarMenuItems(
    companyRole as PermissionRole,
    isOwner
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside
      className={[
        "fixed left-0 top-0 z-30 hidden h-screen border-r border-slate-200/70 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-[80px]" : "w-[250px]",
      ].join(" ")}
    >
      <div className="flex h-[76px] shrink-0 items-center justify-center px-5 max-[820px]:h-[62px]">
        <img
          src="/logo.svg"
          alt="Hesapişleri"
          className={[
            "w-auto object-contain transition-all duration-200 max-[820px]:h-9",
            collapsed ? "h-8" : "h-12",
          ].join(" ")}
        />
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 max-[820px]:space-y-[2px]">
        {menuItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={[
                "group flex h-[39px] items-center rounded-2xl text-[13px] font-bold transition-all duration-200 max-[820px]:h-[34px] max-[820px]:rounded-xl max-[820px]:text-[12px]",
                collapsed ? "justify-center px-0" : "gap-3 px-3.5",
                isActive
                  ? "bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-[0_12px_26px_rgba(37,99,235,0.24)]"
                  : "text-[#0f1f4d] hover:bg-blue-50/70 hover:text-blue-600",
              ].join(" ")}
            >
              <Icon
                size={17}
                strokeWidth={2.15}
                className={[
                  "shrink-0 transition",
                  isActive ? "text-white" : "text-[#1e3a8a]",
                ].join(" ")}
              />

              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>

                  {item.badge ? (
                    <span
                      className={[
                        "ml-auto rounded-full px-2.5 py-1 text-[10px] font-black leading-none",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </>
              ) : null}
            </Link>
          );
        })}

        {isSuperAdmin ? (
          <Link
            href="/admin"
            title={collapsed ? "Super Admin" : undefined}
            className={[
              "mt-1 flex h-[39px] items-center rounded-2xl text-[13px] font-bold transition-all duration-200 max-[820px]:h-[34px] max-[820px]:rounded-xl max-[820px]:text-[12px]",
              collapsed ? "justify-center px-0" : "gap-3 px-3.5",
              pathname.startsWith("/admin")
                ? "bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]"
                : "text-[#0f1f4d] hover:bg-slate-50 hover:text-slate-950",
            ].join(" ")}
          >
            <ShieldCheck size={17} strokeWidth={2.15} />
            {!collapsed ? <span>Super Admin</span> : null}
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto shrink-0 px-3 pb-4 pt-4 max-[820px]:pb-2 max-[820px]:pt-2">
        {!collapsed ? (
          <>
            <div className="mb-3 h-px bg-slate-200 max-[820px]:hidden" />

            <div className="grid grid-cols-1 gap-3 max-[820px]:hidden">
              <div className="rounded-2xl border border-emerald-100 bg-linear-to-br from-emerald-50 to-white p-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Wallet size={17} strokeWidth={2.2} />
                </div>

                <p className="mt-2 text-[12px] font-black text-[#0f1f4d]">
                  Hesap
                </p>

                <div className="mt-1 space-y-1 text-[10.5px] leading-4">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500">Paket</span>
                    <span className="font-black text-[#0f1f4d]">Standart</span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span className="text-slate-500">Ödeme</span>
                    <span className="font-black text-[#0f1f4d]">
                      12.05.2026
                    </span>
                  </div>
                </div>

                <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                  Aktif
                </span>
              </div>
            </div>

            <div className="mt-4 h-px bg-slate-200 max-[820px]:mt-2" />
          </>
        ) : null}

        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className={[
              "flex h-9 w-full items-center rounded-xl text-[12px] font-bold text-[#0f1f4d] transition hover:bg-slate-50 max-[820px]:h-8 max-[820px]:text-[11px]",
              collapsed ? "justify-center px-0" : "justify-between px-2.5",
            ].join(" ")}
          >
            <span
              className={[
                "flex items-center gap-2",
                collapsed ? "justify-center" : "",
              ].join(" ")}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0f1f4d] max-[820px]:h-6 max-[820px]:w-6">
                {collapsed ? (
                  <ChevronRight size={15} />
                ) : (
                  <ChevronLeft size={15} />
                )}
              </span>
              {!collapsed ? "Menüyü Daralt" : null}
            </span>

            {!collapsed ? <span className="text-slate-400">›</span> : null}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Çıkış Yap" : undefined}
            className={[
              "flex h-9 w-full items-center rounded-xl text-[12px] font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-600 max-[820px]:h-8 max-[820px]:text-[11px]",
              collapsed ? "justify-center px-0" : "gap-2 px-2.5",
            ].join(" ")}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500 max-[820px]:h-6 max-[820px]:w-6">
              <LogOut size={15} />
            </span>
            {!collapsed ? "Çıkış Yap" : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
