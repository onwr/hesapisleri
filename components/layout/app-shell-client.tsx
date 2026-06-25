"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { AiDrawerProvider } from "@/components/ai-assistant/ai-drawer-context";
import { AiFloatingLauncher } from "@/components/ai-assistant/ai-floating-launcher";
import { GlobalAiDrawer } from "@/components/ai-assistant/global-ai-drawer";
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
  membershipSummary?: {
    statusLabel: string;
    remainingDays: number;
    isExpired: boolean;
  };
};

function AppShellMain({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={`px-5 py-6 transition-[margin] duration-200 max-md:min-w-0 lg:px-8 ${sidebarOffsetClass(collapsed)}`}
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
  membershipSummary,
}: AppShellClientProps) {
  return (
    <SidebarProvider>
      <AiDrawerProvider>
        <div className="min-h-screen bg-[#f7f8ff] max-md:overflow-x-clip">
          <AppSidebar
            userName={userName ?? "Kullanıcı"}
            companyName={companyName ?? "Firma"}
            companyRole={companyRole}
            isSuperAdmin={isSuperAdmin}
            isOwner={isOwner}
            membershipSummary={membershipSummary}
          />
          <AppTopbar userName={userName} companyName={companyName} />
          <AppShellMain>{children}</AppShellMain>
          <AiFloatingLauncher />
          <GlobalAiDrawer />
        </div>
      </AiDrawerProvider>
    </SidebarProvider>
  );
}
