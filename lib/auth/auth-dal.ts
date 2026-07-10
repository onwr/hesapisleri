import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Company, User, UserRole } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  getPostAuthRedirectPath,
  resolveEffectiveRole,
} from "@/lib/permission-utils";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import { redirectIfMaintenanceActive } from "@/lib/platform-runtime/platform-availability";
import { AUTH_COOKIE_NAME } from "./auth-cookie";
import {
  buildSessionExpiredLoginUrl,
  sanitizeAuthRedirectPath,
} from "./auth-redirect";
import {
  type SessionTokenPayload,
  verifySessionToken,
} from "./jwt";

export type AuthState =
  | { status: "GUEST" }
  | {
      status: "AUTHENTICATED";
      userId: string;
      companyId: string;
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
    }
  | {
      status: "COMPANY_REQUIRED";
      userId: string;
      user: User;
    }
  | {
      status: "INVALID_SESSION";
      reason: string;
    };

type AuthPayload = SessionTokenPayload & {
  userId: string;
  companyId?: string | null;
  role?: UserRole;
};

async function readAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

function buildPlatformCompany(user: User): Company {
  return {
    id: "platform",
    name: "Platform Yönetimi",
    taxNo: null,
    taxOffice: null,
    phone: null,
    email: null,
    address: null,
    logoUrl: null,
    referringPartnerId: null,
    referralCode: null,
    referredAt: null,
    status: "ACTIVE",
    suspendedAt: null,
    suspendedReason: null,
    suspendedUntil: null,
    suspendedByUserId: null,
    archivedAt: null,
    archivedByUserId: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const resolveAuthState = cache(async (): Promise<AuthState> => {
  const token = await readAuthToken();

  if (!token) {
    return { status: "GUEST" };
  }

  const payload = verifySessionToken<AuthPayload>(token);

  if (!payload?.userId) {
    return { status: "INVALID_SESSION", reason: "invalid-token" };
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
    return { status: "INVALID_SESSION", reason: "user-not-found" };
  }

  if (user.status !== "ACTIVE") {
    return { status: "INVALID_SESSION", reason: "user-inactive" };
  }

  // sv (sessionVersion) kontrolü: eksik veya eşleşmiyorsa token geçersiz.
  // Eski sv içermeyen tokenlar da reddedilir (sessiz uyumluluk yok).
  // proxy.ts yalnızca imza + exp kontrolü yapar; revocation bu katmanda yapılır.
  if (payload.sv === undefined || payload.sv !== user.sessionVersion) {
    return { status: "INVALID_SESSION", reason: "session-revoked" };
  }

  if (user.role === "SUPER_ADMIN" || isPlatformSuperAdminUser(user)) {
    const membership = user.companyUsers.find(
      (entry) => entry.company?.status === "ACTIVE"
    );

    if (membership?.company) {
      return {
        status: "AUTHENTICATED",
        userId: user.id,
        companyId: membership.companyId,
        user,
        company: membership.company,
        companyUser: {
          id: membership.id,
          role: membership.role,
          isOwner: membership.isOwner,
          status: membership.status,
        },
        effectiveRole: "SUPER_ADMIN",
        isSuperAdmin: true,
      };
    }

    return {
      status: "AUTHENTICATED",
      userId: user.id,
      companyId: "platform",
      user,
      company: buildPlatformCompany(user),
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

  const activeMemberships = user.companyUsers.filter(
    (entry) => entry.company?.status === "ACTIVE"
  );

  if (activeMemberships.length === 0) {
    return {
      status: "COMPANY_REQUIRED",
      userId: user.id,
      user,
    };
  }

  const membership =
    (payload.companyId
      ? activeMemberships.find(
          (entry) => entry.companyId === payload.companyId
        )
      : undefined) ?? activeMemberships[0];

  if (!membership?.company) {
    return {
      status: "COMPANY_REQUIRED",
      userId: user.id,
      user,
    };
  }

  const effectiveRole = resolveEffectiveRole({
    role: membership.role,
    isOwner: membership.isOwner,
  });

  return {
    status: "AUTHENTICATED",
    userId: user.id,
    companyId: membership.companyId,
    user,
    company: membership.company,
    companyUser: {
      id: membership.id,
      role: membership.role,
      isOwner: membership.isOwner,
      status: membership.status,
    },
    effectiveRole,
    isSuperAdmin: isPlatformSuperAdminUser(user),
  };
});

export async function getOptionalSession() {
  const state = await resolveAuthState();
  return state.status === "AUTHENTICATED" ? state : null;
}

export async function verifySession() {
  return resolveAuthState();
}

export async function getCurrentUser() {
  const state = await resolveAuthState();

  if (state.status === "AUTHENTICATED" || state.status === "COMPANY_REQUIRED") {
    return state.user;
  }

  return null;
}

export function resolveAuthenticatedDestination(
  state: AuthState,
  nextPath?: string | null
) {
  if (state.status === "GUEST" || state.status === "INVALID_SESSION") {
    return null;
  }

  if (state.status === "COMPANY_REQUIRED") {
    return "/companies/select";
  }

  if (nextPath) {
    return sanitizeAuthRedirectPath(nextPath);
  }

  if (state.isSuperAdmin && state.effectiveRole === "SUPER_ADMIN") {
    return "/admin";
  }

  return getPostAuthRedirectPath(
    state.effectiveRole,
    state.companyUser.isOwner
  );
}

export async function getAuthenticatedRedirectTarget(
  nextPath?: string | null
) {
  const state = await resolveAuthState();
  return resolveAuthenticatedDestination(state, nextPath);
}

export async function requireAuthenticatedUser() {
  const state = await resolveAuthState();

  if (state.status === "GUEST") {
    redirect("/login");
  }

  if (state.status === "INVALID_SESSION") {
    redirect(buildSessionExpiredLoginUrl());
  }

  return state;
}

export async function requireCompanySelectionAccess() {
  const state = await requireAuthenticatedUser();

  if (state.status === "AUTHENTICATED") {
    await redirectIfMaintenanceActive(state.isSuperAdmin);
  } else if (state.status === "COMPANY_REQUIRED") {
    await redirectIfMaintenanceActive(isPlatformSuperAdminUser(state.user));
  }

  return state;
}

export async function requireCompanyUser() {
  const state = await resolveAuthState();

  if (state.status === "GUEST") {
    redirect("/login");
  }

  if (state.status === "INVALID_SESSION") {
    redirect(buildSessionExpiredLoginUrl());
  }

  if (state.status === "COMPANY_REQUIRED") {
    await redirectIfMaintenanceActive(isPlatformSuperAdminUser(state.user));
    redirect("/companies/select");
  }

  if (state.status === "AUTHENTICATED") {
    await redirectIfMaintenanceActive(state.isSuperAdmin);
  }

  return state;
}
