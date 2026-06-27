import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { detectUserIssues } from "@/lib/admin/users/admin-user-issue-service";
import { maskIp } from "@/lib/admin/users/admin-user-serializers";

export type AdminUserTab =
  | "overview"
  | "companies"
  | "security"
  | "activity"
  | "support"
  | "notes";

export async function getAdminUserHeader(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      loginTrackingStatus: true,
      lastLoginAt: true,
      emailVerificationStatus: true,
      suspendedAt: true,
      createdAt: true,
      companyUsers: { select: { id: true } },
    },
  });

  if (!user) return null;

  const pendingInviteCount = await db.companyInvite.count({
    where: { email: user.email, status: "PENDING" },
  });

  const issues = detectUserIssues({
    status: user.status,
    loginTrackingStatus: user.loginTrackingStatus,
    lastLoginAt: user.lastLoginAt,
    emailVerificationStatus: user.emailVerificationStatus,
    hasPendingInvite: pendingInviteCount > 0,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    platformRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
    status: user.status,
    loginTrackingStatus: user.loginTrackingStatus,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    emailVerificationStatus: user.emailVerificationStatus,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    companyCount: user.companyUsers.length,
    issues,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getAdminUserOverviewTab(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      loginTrackingStatus: true,
      lastLoginAt: true,
      emailVerificationStatus: true,
      suspendedAt: true,
      suspendedReason: true,
      suspendedUntil: true,
      suspendedByAdmin: { select: { id: true, name: true, email: true } },
      createdAt: true,
      updatedAt: true,
      companyUsers: { select: { id: true } },
      activityLogs: { select: { id: true } },
    },
  });

  if (!user) return null;

  const pendingInviteCount = await db.companyInvite.count({
    where: { email: user.email, status: "PENDING" },
  });

  const issues = detectUserIssues({
    status: user.status,
    loginTrackingStatus: user.loginTrackingStatus,
    lastLoginAt: user.lastLoginAt,
    emailVerificationStatus: user.emailVerificationStatus,
    hasPendingInvite: pendingInviteCount > 0,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    platformRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
    status: user.status,
    loginTrackingStatus: user.loginTrackingStatus,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    emailVerificationStatus: user.emailVerificationStatus,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    suspendedReason: user.suspendedReason,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    suspendedByAdmin: user.suspendedByAdmin,
    companyCount: user.companyUsers.length,
    activityCount: user.activityLogs.length,
    issues,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getAdminUserCompaniesTab(userId: string) {
  const memberships = await db.companyUser.findMany({
    where: { userId },
    include: {
      company: { select: { id: true, name: true, status: true } },
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });

  return memberships.map((m) => ({
    id: m.id,
    companyId: m.company.id,
    companyName: m.company.name,
    companyStatus: m.company.status,
    role: m.role,
    status: m.status,
    isOwner: m.isOwner,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function getAdminUserSecurityTab(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      sessionVersion: true,
      emailVerificationStatus: true,
      // password hash asla dönmez
      passwordResetTokens: {
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        select: {
          id: true,
          expiresAt: true,
          createdAt: true,
          createdByAdmin: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  if (!user) return null;

  return {
    status: user.status,
    // sessionVersion sayısı gösterilir ama değeri gösterilmez
    hasActiveSessions: true,
    emailVerificationStatus: user.emailVerificationStatus,
    // Açık reset tokenları: hash ve rawToken asla dönmez, sadece meta
    openResetTokens: user.passwordResetTokens.map((t) => ({
      id: t.id,
      expiresAt: t.expiresAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      createdByAdmin: t.createdByAdmin,
    })),
    accountLockStatus: "NOT_TRACKED" as const,
  };
}

export async function getAdminUserActivityTab(
  userId: string,
  params: {
    page?: number;
    pageSize?: number;
    module?: string;
    action?: string;
    companyId?: string;
  }
) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 30));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ActivityLogWhereInput = { userId };

  if (params.module && params.module !== "ALL") {
    where.module = params.module;
  }
  if (params.action && params.action !== "ALL") {
    where.action = params.action;
  }
  if (params.companyId) {
    where.companyId = params.companyId;
  }

  const [total, logs] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        module: true,
        action: true,
        message: true,
        ip: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: logs.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      message: log.message ?? "",
      ip: maskIp(log.ip),
      company: log.company,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getAdminUserSupportTab(userId: string) {
  const userRecord = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const [pendingInvites, openResetTokenMeta] = await Promise.all([
    userRecord
      ? db.companyInvite.findMany({
          where: { email: userRecord.email, status: "PENDING" },
          include: { company: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    db.passwordResetToken.findMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        expiresAt: true,
        createdAt: true,
        // tokenHash asla dönmez
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    pendingInvites: pendingInvites.map((inv) => ({
      id: inv.id,
      companyName: inv.company.name,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
    openResetTokens: openResetTokenMeta.map((t) => ({
      id: t.id,
      expiresAt: t.expiresAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
    mailConfigured: false,
  };
}
