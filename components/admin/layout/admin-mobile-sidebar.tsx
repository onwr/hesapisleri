"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import { AdminNavItemLink } from "./admin-nav-item";
import { AdminSidebarFooter } from "./admin-sidebar-footer";
import { useAdminSidebar } from "./admin-sidebar-context";

type AdminMobileSidebarProps = {
  userName: string;
  userEmail: string;
  firmPanelHref: string;
};

export function AdminMobileSidebar({
  userName,
  userEmail,
  firmPanelHref,
}: AdminMobileSidebarProps) {
  const pathname = usePathname();
  const { mobileOpen, closeMobile } = useAdminSidebar();
  const panelRef = useRef<HTMLDivElement>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    if (!mobileOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }, [mobileOpen]);

  if (!mobileOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        aria-label="Menüyü kapat"
        onClick={closeMobile}
      />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 flex w-[min(88vw,300px)] flex-col border-r border-slate-200/70 bg-white shadow-2xl"
      >
        <div className="flex h-[76px] items-center justify-between border-b border-slate-200/70 px-4">
          <div>
            <img src="/logo.svg" alt="Hesap İşleri" className="h-9 w-auto" />
            <p className="text-[11px] font-semibold text-slate-500">
              Platform Yönetimi
            </p>
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Menüyü kapat"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {ADMIN_NAV_GROUPS.map((group) => {
            const enabledItems = group.items.filter((i) => i.enabled !== false);
            const disabledItems = group.items.filter((i) => i.enabled === false);
            const visibleItems =
              showComingSoon
                ? [...enabledItems, ...disabledItems]
                : enabledItems;

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="mb-3">
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <AdminNavItemLink
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      collapsed={false}
                      onNavigate={closeMobile}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setShowComingSoon((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-400"
          >
            <ChevronDown
              size={14}
              className={showComingSoon ? "rotate-180" : ""}
            />
            {showComingSoon ? "Yakında öğeleri gizle" : "Yakında öğeleri göster"}
          </button>
        </nav>

        <AdminSidebarFooter
          userName={userName}
          userEmail={userEmail}
          firmPanelHref={firmPanelHref}
        />
      </div>
    </div>
  );
}
