import { redirect } from "next/navigation";
import type { Company, User, UserRole } from "@prisma/client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { resolveEffectiveRole } from "@/lib/permission-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
  role?: UserRole;
};

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
  const token = await getAuthToken();

  if (!token) {
    redirect("/login");
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        where: { status: "ACTIVE" },
        include: { company: true },
        orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.role === "SUPER_ADMIN") {
    const membership = user.companyUsers[0];

    if (membership?.company && membership.status === "ACTIVE") {
      const effectiveRole = resolveEffectiveRole({
        role: membership.role,
        isOwner: membership.isOwner,
      });

      return {
        user,
        company: membership.company,
        companyUser: {
          id: membership.id,
          role: membership.role,
          isOwner: membership.isOwner,
          status: membership.status,
        },
        effectiveRole,
        isSuperAdmin: true,
      };
    }

    return {
      user,
      company: {
        id: "platform",
        name: "Platform Yönetimi",
        taxNo: null,
        taxOffice: null,
        phone: null,
        email: null,
        address: null,
        logoUrl: null,
        status: "ACTIVE",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      companyUser: {
        id: "platform-admin",
        role: "SUPER_ADMIN",
        isOwner: false,
        status: "ACTIVE",
      },
      effectiveRole: "SUPER_ADMIN",
      isSuperAdmin: true,
    };
  }

  const membership =
    (payload.companyId
      ? user.companyUsers.find((entry) => entry.companyId === payload.companyId)
      : undefined) ?? user.companyUsers[0];

  if (!membership?.company || membership.status !== "ACTIVE") {
    redirect("/login");
  }

  const effectiveRole = resolveEffectiveRole({
    role: membership.role,
    isOwner: membership.isOwner,
  });

  return {
    user,
    company: membership.company,
    companyUser: {
      id: membership.id,
      role: membership.role,
      isOwner: membership.isOwner,
      status: membership.status,
    },
    effectiveRole,
    isSuperAdmin: false,
  };
}
