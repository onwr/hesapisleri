"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import { AdminNavItemLink } from "./admin-nav-item";
import { AdminSidebarFooter } from "./admin-sidebar-footer";
import { useAdminSidebar } from "./admin-sidebar-context";
import { appSidebarClass } from "@/lib/admin-ui";

type AdminSidebarProps = {
  userName: string;
  userEmail: string;
  firmPanelHref: string;
};

export function AdminSidebar({
  userName,
  userEmail,
  firmPanelHref,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useAdminSidebar();
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <aside
      className={[
        appSidebarClass,
        collapsed ? "w-[80px]" : "w-[250px]",
      ].join(" ")}
    >
      <div className="flex h-[76px] shrink-0 items-center justify-between px-4">
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <img
              src="/logo.svg"
              alt="Hesap İşleri"
              className="h-10 w-auto object-contain"
            />
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
              Platform Yönetimi
            </p>
          </div>
        ) : (
          <img
            src="/logo.svg"
            alt="Hesap İşleri"
            className="mx-auto h-8 w-auto object-contain"
          />
        )}
        {!collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-100 hover:bg-blue-50/70 hover:text-blue-600"
            aria-label="Kenar çubuğunu daralt"
          >
            <ChevronLeft size={16} />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center px-2 pb-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-100 hover:bg-blue-50/70 hover:text-blue-600"
            aria-label="Kenar çubuğunu genişlet"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {ADMIN_NAV_GROUPS.map((group) => {
          const enabledItems = group.items.filter((item) => item.enabled !== false);
          const disabledItems = group.items.filter((item) => item.enabled === false);
          const visibleItems =
            disabledItems.length > 0 && !showComingSoon
              ? enabledItems
              : [...enabledItems, ...disabledItems];

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="mb-3 last:mb-0">
              {!collapsed ? (
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <AdminNavItemLink
                    key={item.id}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {!collapsed ? (
          <button
            type="button"
            onClick={() => setShowComingSoon((v) => !v)}
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <ChevronDown
              size={14}
              className={showComingSoon ? "rotate-180 transition" : "transition"}
            />
            {showComingSoon ? "Yakında öğeleri gizle" : "Yakında öğeleri göster"}
          </button>
        ) : null}
      </nav>

      <AdminSidebarFooter
        userName={userName}
        userEmail={userEmail}
        firmPanelHref={firmPanelHref}
      />
    </aside>
  );
}
