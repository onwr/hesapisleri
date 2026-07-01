import type { ReactNode } from "react";
import { getAppSession } from "@/lib/app-session";
import { getSidebarMembershipSummary } from "@/lib/membership-service";
import { canAccessModule } from "@/lib/permission-utils";
import { getAiPlatformStatus } from "@/lib/ai/ai-config";
import type { AiPlatformStatus } from "@/lib/ai/ai-config";
import { AppShellClient } from "./app-shell-client";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const session = await getAppSession();
  const membershipSummary = await getSidebarMembershipSummary(session.company.id);

  // canUseAi = yalnızca rol/modül permission'ı (platform durumundan bağımsız).
  // STAFF ve POS_STAFF launcher göremez; platform disabled/config_missing olsa bile
  // yetkili kullanıcılar launcher'ı görür — durum launcher içinde ayrı iletilir.
  const canUseAi = canAccessModule(
    session.effectiveRole,
    "ai-assistant",
    session.companyUser.isOwner,
  );
  const aiPlatformStatus: AiPlatformStatus = getAiPlatformStatus();

  return (
    <AppShellClient
      userName={session.user.name}
      companyName={session.company.name}
      companyRole={session.effectiveRole}
      isSuperAdmin={session.isSuperAdmin}
      isOwner={session.companyUser.isOwner}
      membershipSummary={membershipSummary}
      canUseAi={canUseAi}
      aiPlatformStatus={aiPlatformStatus}
    >
      {children}
    </AppShellClient>
  );
}
