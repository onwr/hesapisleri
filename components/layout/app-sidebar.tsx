"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  getSidebarNavItems,
  isSidebarSubMenuItemActive,
  type SidebarMenuGroup,
  type SidebarNavEntry,
} from "@/lib/sidebar-menu";
import type { PermissionRole } from "@/lib/permission-utils";
import { useSidebar } from "./sidebar-context";

type AppSidebarProps = {
  userName: string;
  companyName: string;
  companyRole?: string;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
  membershipSummary?: {
    statusLabel: string;
    remainingDays: number;
    isExpired: boolean;
  };
};

function SidebarMembershipSummary({
  summary,
  collapsed,
}: {
  summary: NonNullable<AppSidebarProps["membershipSummary"]>;
  collapsed: boolean;
}) {
  const remainingLabel = summary.isExpired
    ? "Yenileme gerekli"
    : `${summary.remainingDays} gün kaldı`;

  const toneClass = summary.isExpired
    ? "border-red-200 bg-red-50 text-red-700"
    : summary.remainingDays <= 7
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-[#0f1f4d]";

  if (collapsed) {
    return (
      <Link
        href="/settings/billing"
        title={`${summary.statusLabel} · ${remainingLabel}`}
        className={[
          "mb-2 flex h-9 w-full items-center justify-center rounded-xl border transition hover:opacity-90",
          toneClass,
        ].join(" ")}
      >
        <Clock3 size={15} strokeWidth={2.2} />
      </Link>
    );
  }

  return (
    <Link
      href="/settings/billing"
      className={[
        "mb-2 block rounded-xl border px-2.5 py-2 transition hover:opacity-90",
        toneClass,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
          {summary.statusLabel}
        </span>
        <Clock3 size={12} strokeWidth={2.2} className="shrink-0 opacity-70" />
      </div>
      <p className="mt-0.5 text-[11px] font-black">{remainingLabel}</p>
    </Link>
  );
}

function SidebarLinkItem({
  entry,
  pathname,
  collapsed,
}: {
  entry: Extract<SidebarNavEntry, { type: "link" }>;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = entry.icon;
  const isActive =
    pathname === entry.href ||
    (entry.href !== "/dashboard" && pathname.startsWith(`${entry.href}/`));

  return (
    <Link
      href={entry.href}
      title={collapsed ? entry.title : undefined}
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
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>

          {entry.badge ? (
            <span
              className={[
                "ml-auto rounded-full px-2.5 py-1 text-[10px] font-black leading-none",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {entry.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function SidebarGroupItem({
  group,
  pathname,
  collapsed,
}: {
  group: SidebarMenuGroup;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = group.icon;
  const hasActiveChild = group.items.some((item) =>
    isSidebarSubMenuItemActive(pathname, item.href)
  );
  const [open, setOpen] = useState(hasActiveChild);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  useEffect(() => {
    if (!flyoutOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(event.target as Node)
      ) {
        setFlyoutOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [flyoutOpen]);

  if (collapsed) {
    return (
      <div ref={flyoutRef} className="relative">
        <button
          type="button"
          title={group.title}
          onClick={() => setFlyoutOpen((value) => !value)}
          className={[
            "flex h-[39px] w-full items-center justify-center rounded-2xl text-[13px] font-bold transition-all duration-200 max-[820px]:h-[34px] max-[820px]:rounded-xl",
            hasActiveChild
              ? "bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-[0_12px_26px_rgba(37,99,235,0.24)]"
              : "text-[#0f1f4d] hover:bg-blue-50/70 hover:text-blue-600",
          ].join(" ")}
        >
          <Icon
            size={17}
            strokeWidth={2.15}
            className={hasActiveChild ? "text-white" : "text-[#1e3a8a]"}
          />
        </button>

        {flyoutOpen ? (
          <div className="absolute left-full top-0 z-40 ml-2 min-w-[210px] rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
            <p className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = isSidebarSubMenuItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setFlyoutOpen(false)}
                    className={[
                      "flex h-9 items-center rounded-xl px-3 text-[12px] font-bold transition",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-[#0f1f4d] hover:bg-slate-50 hover:text-blue-600",
                    ].join(" ")}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={[
          "flex h-[39px] w-full items-center rounded-2xl text-[13px] font-bold transition-all duration-200 max-[820px]:h-[34px] max-[820px]:rounded-xl max-[820px]:text-[12px]",
          "gap-3 px-3.5",
          hasActiveChild
            ? "bg-blue-50/80 text-blue-700"
            : "text-[#0f1f4d] hover:bg-blue-50/70 hover:text-blue-600",
        ].join(" ")}
      >
        <Icon
          size={17}
          strokeWidth={2.15}
          className={hasActiveChild ? "text-blue-600" : "text-[#1e3a8a]"}
        />
        <span className="min-w-0 flex-1 truncate text-left">{group.title}</span>
        <ChevronDown
          size={15}
          className={[
            "shrink-0 text-slate-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="ml-3 space-y-1 border-l border-slate-200/80 pl-2">
          {group.items.map((item) => {
            const isActive = isSidebarSubMenuItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex h-[34px] items-center rounded-xl px-3 text-[12px] font-bold transition",
                  isActive
                    ? "bg-linear-to-r from-blue-600 to-blue-500 text-white shadow-[0_10px_22px_rgba(37,99,235,0.2)]"
                    : "text-[#0f1f4d] hover:bg-blue-50/70 hover:text-blue-600",
                ].join(" ")}
              >
                {item.title}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  companyRole = "STAFF",
  isSuperAdmin = false,
  isOwner = false,
  membershipSummary,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const menuItems = getSidebarNavItems(
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
        {menuItems.map((entry) => {
          if (entry.type === "group") {
            return (
              <SidebarGroupItem
                key={entry.id}
                group={entry}
                pathname={pathname}
                collapsed={collapsed}
              />
            );
          }

          return (
            <SidebarLinkItem
              key={entry.href}
              entry={entry}
              pathname={pathname}
              collapsed={collapsed}
            />
          );
        })}

        {isSuperAdmin ? (
          <Link
            href="/admin"
            title={collapsed ? "Platform Yönetimi" : undefined}
            className={[
              "mt-1 flex h-[39px] items-center rounded-2xl text-[13px] font-bold transition-all duration-200 max-[820px]:h-[34px] max-[820px]:rounded-xl max-[820px]:text-[12px]",
              collapsed ? "justify-center px-0" : "gap-3 px-3.5",
              pathname.startsWith("/admin")
                ? "bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]"
                : "text-[#0f1f4d] hover:bg-slate-50 hover:text-slate-950",
            ].join(" ")}
          >
            <ShieldCheck size={17} strokeWidth={2.15} />
            {!collapsed ? <span>Platform Yönetimi</span> : null}
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto shrink-0 px-3 pb-4 pt-4 max-[820px]:pb-2 max-[820px]:pt-2">
        {membershipSummary ? (
          <SidebarMembershipSummary
            summary={membershipSummary}
            collapsed={collapsed}
          />
        ) : null}

        {!collapsed ? (
          <div className="mb-2 h-px bg-slate-200 max-[820px]:hidden" />
        ) : null}

        <div className="space-y-1">
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
