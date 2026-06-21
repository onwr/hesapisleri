"use client";

import type { ReactNode } from "react";
import type { AdminEnvironment } from "@/lib/admin-environment";
import { appPageBgClass } from "@/lib/admin-ui";
import { AdminMobileSidebar } from "./admin-mobile-sidebar";
import { AdminSidebar } from "./admin-sidebar";
import {
  AdminSidebarProvider,
  adminSidebarOffsetClass,
  useAdminSidebar,
} from "./admin-sidebar-context";
import { AdminTopbar } from "./admin-topbar";

type AdminShellClientProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
  firmPanelHref: string;
  environment: AdminEnvironment;
};

function AdminShellMain({ children }: { children: ReactNode }) {
  const { collapsed } = useAdminSidebar();

  return (
    <main
      className={[
        "px-5 py-6 transition-[margin] duration-200 max-md:min-w-0 lg:px-8",
        adminSidebarOffsetClass(collapsed),
      ].join(" ")}
    >
      {children}
    </main>
  );
}

export function AdminShellClient({
  children,
  userName,
  userEmail,
  firmPanelHref,
  environment,
}: AdminShellClientProps) {
  return (
    <AdminSidebarProvider>
      <div className={`min-h-screen ${appPageBgClass} max-md:overflow-x-clip`}>
        <AdminSidebar
          userName={userName}
          userEmail={userEmail}
          firmPanelHref={firmPanelHref}
        />
        <AdminMobileSidebar
          userName={userName}
          userEmail={userEmail}
          firmPanelHref={firmPanelHref}
        />
        <div className="min-w-0">
          <AdminTopbar
            userName={userName}
            userEmail={userEmail}
            firmPanelHref={firmPanelHref}
            environment={environment}
          />
          <AdminShellMain>{children}</AdminShellMain>
        </div>
      </div>
    </AdminSidebarProvider>
  );
}
