import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireCompanyUser } from "@/lib/auth/auth-dal";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireCompanyUser();

  if (session.isSuperAdmin && session.effectiveRole === "SUPER_ADMIN") {
    redirect("/admin");
  }

  return children;
}
