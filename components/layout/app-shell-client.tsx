"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { AiDrawerProvider } from "@/components/ai-assistant/ai-drawer-context";
import { AiFloatingLauncher } from "@/components/ai-assistant/ai-floating-launcher";
import { GlobalAiDrawer } from "@/components/ai-assistant/global-ai-drawer";
import type { AiPlatformStatus } from "@/lib/ai/ai-config";
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
  canUseAi?: boolean;
  aiPlatformStatus?: AiPlatformStatus;
  membershipSummary?: {
    statusLabel: string;
    remainingDays: number;
    isExpired: boolean;
    periodEndLabel?: string | null;
    primaryDateLabel?: string | null;
    primaryDateDisplay?: string | null;
    policyNote?: string | null;
  };
};

function AppShellMain({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`px-5 py-6 text-[15px] transition-[margin] duration-200 max-md:min-w-0 lg:px-8 ${sidebarOffsetClass(collapsed)}`}
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
  canUseAi = false,
  aiPlatformStatus = "enabled",
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
          {canUseAi ? <AiFloatingLauncher /> : null}
          {canUseAi ? <GlobalAiDrawer /> : null}
        </div>
      </AiDrawerProvider>
    </SidebarProvider>
  );
}
