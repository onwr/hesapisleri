import type { ReactNode } from "react";
import { getAppSession } from "@/lib/app-session";
import { AppShellClient } from "./app-shell-client";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const session = await getAppSession();

  return (
    <AppShellClient
      userName={session.user.name}
      companyName={session.company.name}
      companyRole={session.effectiveRole}
      isSuperAdmin={session.isSuperAdmin}
      isOwner={session.companyUser.isOwner}
    >
      {children}
    </AppShellClient>
  );
}
