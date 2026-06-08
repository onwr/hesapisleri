"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import {
  SidebarProvider,
  sidebarOffsetClass,
  useSidebar,
} from "./sidebar-context";

type AppShellClientProps = {
  children: ReactNode;
  userName?: string;
  companyName?: string;
  companyRole?: string;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
};

function AppShellMain({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={`px-5 py-6 transition-[margin] duration-200 lg:px-8 ${sidebarOffsetClass(collapsed)}`}
    >
      {children}
    </main>
  );
}

export function AppShellClient({
  children,
  userName,
  companyName,
  companyRole,
  isSuperAdmin = false,
  isOwner = false,
}: AppShellClientProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#f7f8ff]">
        <AppSidebar
          userName={userName ?? "Kullanıcı"}
          companyName={companyName ?? "Firma"}
          companyRole={companyRole}
          isSuperAdmin={isSuperAdmin}
          isOwner={isOwner}
        />
        <AppTopbar userName={userName} companyName={companyName} />
        <AppShellMain>{children}</AppShellMain>
      </div>
    </SidebarProvider>
  );
}
