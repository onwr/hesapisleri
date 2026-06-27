import { db } from "@/lib/prisma";
import { getUserRoleLabel } from "@/lib/settings-utils";

export class AuthCompaniesError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthCompaniesError";
    this.status = status;
  }
}

export async function listUserCompanies(
  userId: string,
  currentCompanyId: string | null
) {
  const memberships = await db.companyUser.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      company: true,
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });

  return memberships.map((entry) => ({
    companyId: entry.companyId,
    companyName: entry.company.name,
    logoUrl: entry.company.logoUrl,
    role: entry.role,
    roleLabel: getUserRoleLabel(entry.role),
    isOwner: entry.isOwner,
    isActive: entry.status === "ACTIVE",
    isCurrent: entry.companyId === currentCompanyId,
  }));
}

export async function switchUserCompany(input: {
  userId: string;
  companyId: string;
}) {
  const membership = await db.companyUser.findFirst({
    where: {
      userId: input.userId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
    include: {
      user: true,
      company: true,
    },
  });

  if (!membership) {
    throw new AuthCompaniesError(
      "Bu firmaya erişim yetkiniz yok veya üyeliğiniz pasif.",
      403
    );
  }

  return {
    companyId: membership.companyId,
    companyName: membership.company.name,
    membershipRole: membership.role,
    isOwner: membership.isOwner,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      role: membership.user.role,
      sessionVersion: membership.user.sessionVersion,
    },
  };
}
