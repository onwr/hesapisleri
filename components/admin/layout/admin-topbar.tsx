"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu, Search } from "lucide-react";
import type { AdminEnvironment } from "@/lib/admin-environment";
import { appOutlineButtonClass } from "@/lib/admin-ui";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import {
  AdminCommandMenu,
  AdminCommandTrigger,
} from "./admin-command-menu";
import { AdminEnvironmentBadge } from "./admin-environment-badge";
import { AdminUserMenu } from "./admin-user-menu";
import {
  adminSidebarOffsetClass,
  useAdminSidebar,
} from "./admin-sidebar-context";

type AdminTopbarProps = {
  userName: string;
  userEmail: string;
  firmPanelHref: string;
  environment: AdminEnvironment;
  pageTitle?: string;
};

export function AdminTopbar({
  userName,
  userEmail,
  firmPanelHref,
  environment,
  pageTitle,
}: AdminTopbarProps) {
  const { openMobile, collapsed } = useAdminSidebar();
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <>
      <header
        className={[
          "sticky top-0 z-20 flex h-[76px] items-center border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl transition-[margin] duration-200 sm:px-6",
          adminSidebarOffsetClass(collapsed),
        ].join(" ")}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={openMobile}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f1f4d] shadow-sm shadow-slate-100/70 lg:hidden"
              aria-label="Menüyü aç"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <AdminBreadcrumbs />
              {pageTitle ? (
                <p className="mt-0.5 truncate text-[13px] font-bold text-[#0f1f4d] lg:hidden">
                  {pageTitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="hidden max-w-[420px] flex-1 justify-center md:flex">
            <AdminCommandTrigger onClick={() => setCommandOpen(true)} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f1f4d] shadow-sm md:hidden"
              aria-label="Ara"
            >
              <Search size={16} />
            </button>
            <AdminEnvironmentBadge environment={environment} compact />
            <Link href={firmPanelHref} className={`hidden sm:inline-flex ${appOutlineButtonClass}`}>
              <ArrowLeft size={15} />
              Firma Paneli
            </Link>
            <AdminUserMenu
              userName={userName}
              userEmail={userEmail}
              firmPanelHref={firmPanelHref}
            />
          </div>
        </div>
      </header>

      <AdminCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
