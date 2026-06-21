import "server-only";

import { redirect } from "next/navigation";
import { requireCompanyUser } from "@/lib/auth/auth-dal";

export async function requirePageTenantContext() {
  const session = await requireCompanyUser();

  if (session.companyId === "platform") {
    redirect("/companies/select");
  }

  return {
    userId: session.userId,
    companyId: session.companyId,
    company: session.company,
    user: session.user,
    effectiveRole: session.effectiveRole,
    isSuperAdmin: session.isSuperAdmin,
  };
}
