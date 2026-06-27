import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AdminUserListQuery } from "@/lib/admin/users/admin-user-schemas";
import { detectUserIssues } from "@/lib/admin/users/admin-user-issue-service";
import { maskIp } from "@/lib/admin/users/admin-user-serializers";

export async function getAdminUserList(query: AdminUserListQuery) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const where: Prisma.UserWhereInput = {};

  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (query.status !== "ALL") {
    where.status = query.status;
  }

  if (query.platformRole === "SUPER_ADMIN") {
    where.role = "SUPER_ADMIN";
  } else if (query.platformRole === "USER") {
    where.role = { not: "SUPER_ADMIN" };
  }

  if (query.loginStatus === "NEVER") {
    where.loginTrackingStatus = "NEVER_LOGGED_IN";
  } else if (query.loginStatus === "INACTIVE_30D") {
    where.loginTrackingStatus = "LOGGED_IN";
    where.lastLoginAt = { lt: thirtyDaysAgo };
  } else if (query.loginStatus === "ACTIVE_30D") {
    where.loginTrackingStatus = "LOGGED_IN";
    where.lastLoginAt = { gte: thirtyDaysAgo };
  } else if (query.loginStatus === "UNKNOWN") {
    where.loginTrackingStatus = "UNKNOWN_LEGACY";
  }

  if (query.companyCount === "ZERO") {
    where.companyUsers = { none: {} };
  } else if (query.companyCount === "ONE") {
    where.companyUsers = { some: {} };
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    query.sortBy === "lastLoginAt"
      ? { lastLoginAt: query.sortDir }
      : query.sortBy === "name"
        ? { name: query.sortDir }
        : query.sortBy === "status"
          ? { status: query.sortDir }
          : { createdAt: query.sortDir };

  const skip = (query.page - 1) * query.pageSize;

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
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
    }),
  ]);

  const items = users.map((user) => {
    const issues = detectUserIssues({
      status: user.status,
      loginTrackingStatus: user.loginTrackingStatus,
      lastLoginAt: user.lastLoginAt,
      emailVerificationStatus: user.emailVerificationStatus,
      hasPendingInvite: false,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      platformRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
      status: user.status,
      loginTrackingStatus: user.loginTrackingStatus,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      emailVerificationStatus: user.emailVerificationStatus,
      companyCount: user.companyUsers.length,
      issues,
      createdAt: user.createdAt.toISOString(),
    };
  });

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    items,
  };
}

export async function getAdminUsersSummaryExtended() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    total,
    active,
    suspended,
    passive,
    pendingVerification,
    newThisMonth,
    loggedIn30d,
    inactive30d,
    neverLoggedIn,
    unknownLegacy,
    platformAdmins,
    pendingInviteCount,
    multiCompany,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count({ where: { status: "PASSIVE" } }),
    db.user.count({ where: { emailVerificationStatus: "PENDING" } }),
    db.user.count({
      where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
    }),
    db.user.count({
      where: { loginTrackingStatus: "LOGGED_IN", lastLoginAt: { gte: thirtyDaysAgo } },
    }),
    db.user.count({
      where: { loginTrackingStatus: "LOGGED_IN", lastLoginAt: { lt: thirtyDaysAgo } },
    }),
    db.user.count({ where: { loginTrackingStatus: "NEVER_LOGGED_IN" } }),
    db.user.count({ where: { loginTrackingStatus: "UNKNOWN_LEGACY" } }),
    db.user.count({ where: { role: "SUPER_ADMIN" } }),
    db.companyInvite
      .groupBy({ by: ["email"], where: { status: "PENDING" } })
      .then((r) => r.length),
    db.user.count({ where: { companyUsers: { some: {} } } }).then(async () => {
      // Birden fazla firmaya bağlı kullanıcı sayısı
      const result = await db.companyUser.groupBy({
        by: ["userId"],
        _count: { userId: true },
        having: { userId: { _count: { gt: 1 } } },
      });
      return result.length;
    }),
  ]);

  return {
    total,
    active,
    suspended,
    passive,
    pendingInvite: pendingInviteCount,
    pendingVerification,
    newThisMonth,
    loggedIn30d,
    inactive30d,
    neverLoggedIn,
    unknownLegacy,
    platformAdmins,
    multiCompany,
  };
}

export async function exportAdminUsersAsCsv(query: AdminUserListQuery) {
  // Pagination devre dışı, tüm eşleşen kullanıcılar
  const allQuery = { ...query, page: 1, pageSize: 10000 };
  const result = await getAdminUserList(allQuery);

  const header = [
    "ID",
    "Ad Soyad",
    "E-posta",
    "Platform Rolü",
    "Durum",
    "Firma Sayısı",
    "Son Giriş",
    "Kayıt Tarihi",
  ].join(",");

  const rows = result.items.map((u) =>
    [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.platformRole,
      u.status,
      u.companyCount,
      u.lastLoginAt ?? "",
      u.createdAt,
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

// maskIp export için re-export
export { maskIp };
