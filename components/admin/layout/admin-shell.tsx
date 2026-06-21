import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import { getAdminEnvironment } from "@/lib/admin-environment";
import { AdminShellClient } from "./admin-shell-client";

type AdminShellProps = {
  children: ReactNode;
  user: User;
  companyId: string | null;
};

export function AdminShell({ children, user, companyId }: AdminShellProps) {
  const firmPanelHref = companyId ? "/dashboard" : "/companies/select";
  const environment = getAdminEnvironment();

  return (
    <AdminShellClient
      userName={user.name}
      userEmail={user.email}
      firmPanelHref={firmPanelHref}
      environment={environment}
    >
      {children}
    </AdminShellClient>
  );
}
