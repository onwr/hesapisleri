import type { Company, User, UserRole } from "@prisma/client";
import { requireCompanyUser } from "@/lib/auth/auth-dal";

export type AppSession = {
  user: User;
  company: Company;
  companyUser: {
    id: string;
    role: UserRole;
    isOwner: boolean;
    status: string;
  };
  effectiveRole: UserRole;
  isSuperAdmin: boolean;
};

export async function getAppSession(): Promise<AppSession> {
  const session = await requireCompanyUser();

  return {
    user: session.user,
    company: session.company,
    companyUser: session.companyUser,
    effectiveRole: session.effectiveRole,
    isSuperAdmin: session.isSuperAdmin,
  };
}
