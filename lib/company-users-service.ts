import { randomBytes } from "crypto";
import type { CompanyInvite, CompanyUser, UserRole } from "@prisma/client";
import { db } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  buildInviteExpiryDate,
  buildInviteLink,
  isInviteExpired,
  normalizeInviteEmail,
  validateActorCanManageUsers,
  validateInviteTargetEmail,
  validateRemoveCompanyUser,
  getCompanyUserStatusLabel,
  validateRoleChange,
  type AssignableInviteRole,
} from "@/lib/company-users-utils";
import {
  USER_PASSWORD_MIN_LENGTH,
  validateAssignableRole,
  type AssignableCompanyUserRole,
} from "@/lib/company-user-from-employee-utils";
import { resolveInvitePreviewMode } from "@/lib/invite-preview-utils";
import { getUserRoleLabel } from "@/lib/settings-utils";
import { SettingsAccessError } from "@/lib/company-access";

export class CompanyUsersError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "CompanyUsersError";
    this.status = status;
    this.code = code;
  }
}

function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

async function getActiveCompanyUser(userId: string, companyId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
    },
  });

  if (!companyUser) {
    throw new SettingsAccessError("Bu firmaya erişim yetkiniz yok.");
  }

  return companyUser;
}

async function getCompanyUserInCompany(companyUserId: string, companyId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      id: companyUserId,
      companyId,
    },
    include: {
      user: true,
    },
  });

  if (!companyUser) {
    throw new CompanyUsersError("Kullanıcı bulunamadı.", 404);
  }

  return companyUser;
}

function serializeCompanyUser(
  entry: CompanyUser & {
    user: { name: string; email: string; updatedAt?: Date };
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }
) {
  return {
    id: entry.id,
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    role: entry.role,
    roleLabel: getUserRoleLabel(entry.role),
    status: entry.status,
    statusLabel: getCompanyUserStatusLabel(entry.status),
    isOwner: entry.isOwner,
    joinedAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    lastLoginAt: entry.user.updatedAt?.toISOString() ?? null,
    employee: entry.employee
      ? {
          id: entry.employee.id,
          name: `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
        }
      : null,
  };
}

function serializeInvite(invite: CompanyInvite, baseUrl?: string) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    roleLabel: getUserRoleLabel(invite.role),
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    inviteLink: buildInviteLink(invite.token, baseUrl),
  };
}

export async function getCompanyUsersAndInvites(input: {
  companyId: string;
  userId: string;
  baseUrl?: string;
}) {
  await getActiveCompanyUser(input.userId, input.companyId);

  const [companyUsers, invites, actor] = await Promise.all([
    db.companyUser.findMany({
      where: { companyId: input.companyId },
      include: {
        user: { select: { name: true, email: true, updatedAt: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.companyInvite.findMany({
      where: {
        companyId: input.companyId,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    }),
    db.companyUser.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.userId,
      },
    }),
  ]);

  return {
    users: companyUsers.map(serializeCompanyUser),
    invites: invites.map((invite) => serializeInvite(invite, input.baseUrl)),
    permissions: {
      canManageUsers: actor
        ? validateActorCanManageUsers({
            actorRole: actor.role,
            actorIsOwner: actor.isOwner,
          }).ok
        : false,
      currentUserId: input.userId,
      currentCompanyUserId: actor?.id ?? null,
    },
  };
}

export async function createCompanyInvite(input: {
  companyId: string;
  userId: string;
  email: string;
  role: AssignableInviteRole;
  baseUrl?: string;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  const existingMembers = await db.companyUser.findMany({
    where: {
      companyId: input.companyId,
      status: { in: ["ACTIVE", "INVITED"] },
    },
    include: { user: true },
  });

  const emailCheck = validateInviteTargetEmail({
    email: input.email,
    existingMemberEmails: existingMembers.map((entry) => entry.user.email),
  });

  if (!emailCheck.ok) {
    throw new CompanyUsersError(emailCheck.message, 400);
  }

  const { requireCompanyLimit } = await import(
    "@/lib/billing/entitlements/entitlement-enforcement-service"
  );
  try {
    await requireCompanyLimit(input.companyId, "MAX_USERS", { incrementBy: 1 });
  } catch (error) {
    const { EntitlementError } = await import("@/lib/billing/entitlements/entitlement-errors");
    if (error instanceof EntitlementError) {
      throw new CompanyUsersError(error.message, error.status);
    }
    throw error;
  }

  const normalizedEmail = emailCheck.email;
  const token = generateInviteToken();
  const expiresAt = buildInviteExpiryDate();

  const invite = await db.$transaction(async (tx) => {
    const pendingInvite = await tx.companyInvite.findFirst({
      where: {
        companyId: input.companyId,
        email: normalizedEmail,
        status: "PENDING",
      },
    });

    const savedInvite = pendingInvite
      ? await tx.companyInvite.update({
          where: { id: pendingInvite.id },
          data: {
            role: input.role,
            token,
            expiresAt,
            invitedByUserId: input.userId,
            status: "PENDING",
          },
        })
      : await tx.companyInvite.create({
          data: {
            companyId: input.companyId,
            email: normalizedEmail,
            role: input.role,
            token,
            expiresAt,
            invitedByUserId: input.userId,
            status: "PENDING",
          },
        });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        module: "settings",
        message: `${normalizedEmail} adresine ${input.role} rolüyle davet gönderildi.`,
      },
    });

    return savedInvite;
  });

  return {
    invite: serializeInvite(invite, input.baseUrl),
    inviteLink: buildInviteLink(invite.token, input.baseUrl),
  };
}

export async function cancelCompanyInvite(input: {
  companyId: string;
  userId: string;
  inviteId: string;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  const invite = await db.companyInvite.findFirst({
    where: {
      id: input.inviteId,
      companyId: input.companyId,
      status: "PENDING",
    },
  });

  if (!invite) {
    throw new CompanyUsersError("Bekleyen davet bulunamadı.", 404);
  }

  const cancelled = await db.$transaction(async (tx) => {
    const updated = await tx.companyInvite.update({
      where: { id: invite.id },
      data: { status: "CANCELLED" },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: `${invite.email} adresine gönderilen davet iptal edildi.`,
      },
    });

    return updated;
  });

  return cancelled;
}

export async function updateCompanyUserRole(input: {
  companyId: string;
  userId: string;
  companyUserId: string;
  role: AssignableInviteRole;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);
  const target = await getCompanyUserInCompany(input.companyUserId, input.companyId);

  const validation = validateRoleChange({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
    actorUserId: input.userId,
    targetUserId: target.userId,
    targetRole: target.role,
    targetIsOwner: target.isOwner,
    nextRole: input.role,
  });

  if (!validation.ok) {
    throw new CompanyUsersError(validation.message, 403);
  }

  const updated = await db.$transaction(async (tx) => {
    const companyUser = await tx.companyUser.update({
      where: { id: target.id },
      data: { role: input.role as UserRole },
      include: {
        user: { select: { name: true, email: true, updatedAt: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: `${companyUser.user.email} kullanıcısının rolü ${input.role} olarak güncellendi.`,
      },
    });

    return companyUser;
  });

  return serializeCompanyUser(updated);
}

export async function removeCompanyUser(input: {
  companyId: string;
  userId: string;
  companyUserId: string;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);
  const target = await getCompanyUserInCompany(input.companyUserId, input.companyId);

  const validation = validateRemoveCompanyUser({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
    actorUserId: input.userId,
    targetUserId: target.userId,
    targetRole: target.role,
    targetIsOwner: target.isOwner,
  });

  if (!validation.ok) {
    throw new CompanyUsersError(validation.message, 403);
  }

  const updated = await db.$transaction(async (tx) => {
    const companyUser = await tx.companyUser.update({
      where: { id: target.id },
      data: { status: "PASSIVE" },
      include: { user: true },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: `${companyUser.user.email} kullanıcısı firmadan çıkarıldı.`,
      },
    });

    return companyUser;
  });

  return serializeCompanyUser(updated);
}

export async function acceptCompanyInvite(input: {
  token: string;
  userId?: string;
  name?: string;
  password?: string;
}) {
  const invite = await db.companyInvite.findUnique({
    where: { token: input.token },
    include: { company: true },
  });

  if (!invite) {
    throw new CompanyUsersError("Davet bulunamadı.", 404);
  }

  if (invite.status === "ACCEPTED") {
    throw new CompanyUsersError("Bu davet zaten kabul edilmiş.", 400);
  }

  if (invite.status === "REJECTED") {
    throw new CompanyUsersError("Bu davet reddedilmiş.", 400);
  }

  if (invite.status === "CANCELLED") {
    throw new CompanyUsersError("Bu davet iptal edilmiş.", 400);
  }

  if (invite.status !== "PENDING") {
    throw new CompanyUsersError("Davet bulunamadı veya geçersiz.", 404);
  }

  if (isInviteExpired(invite.expiresAt)) {
    await db.companyInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    throw new CompanyUsersError("Davet süresi dolmuş.", 400);
  }

  const normalizedInviteEmail = normalizeInviteEmail(invite.email);

  let user = null as Awaited<ReturnType<typeof db.user.findUnique>>;

  if (input.userId) {
    user = await db.user.findUnique({ where: { id: input.userId } });

    if (!user) {
      throw new CompanyUsersError("Oturum geçersiz.", 401);
    }

    if (normalizeInviteEmail(user.email) !== normalizedInviteEmail) {
      throw new CompanyUsersError(
        "Bu davet farklı bir e-posta adresine gönderilmiş. Lütfen doğru hesapla giriş yapın.",
        403
      );
    }
  } else {
    const existingByEmail = await db.user.findUnique({
      where: { email: normalizedInviteEmail },
    });

    if (existingByEmail) {
      throw new CompanyUsersError(
        "Daveti kabul etmek için giriş yapın.",
        401,
        "LOGIN_REQUIRED"
      );
    }

    if (!input.name || !input.password) {
      throw new CompanyUsersError(
        "Daveti kabul etmek için kayıt bilgileri gereklidir.",
        400
      );
    }

    const hashedPassword = await hashPassword(input.password);

    user = await db.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedInviteEmail,
        password: hashedPassword,
        role: "STAFF",
        status: "ACTIVE",
      },
    });
  }

  const existingMembership = await db.companyUser.findUnique({
    where: {
      companyId_userId: {
        companyId: invite.companyId,
        userId: user.id,
      },
    },
  });

  if (existingMembership?.status === "ACTIVE") {
    throw new CompanyUsersError("Bu kullanıcı zaten şirkette aktif.", 400);
  }

  {
    const { requireCompanyLimit } = await import(
      "@/lib/billing/entitlements/entitlement-enforcement-service"
    );
    const { EntitlementError } = await import("@/lib/billing/entitlements/entitlement-errors");
    try {
      await requireCompanyLimit(invite.companyId, "MAX_USERS", { incrementBy: 1 });
    } catch (error) {
      if (error instanceof EntitlementError) {
        throw new CompanyUsersError(error.message, error.status);
      }
      throw error;
    }
  }

  const result = await db.$transaction(async (tx) => {
    const companyUser = existingMembership
      ? await tx.companyUser.update({
          where: { id: existingMembership.id },
          data: {
            role: invite.role,
            status: "ACTIVE",
            isOwner: false,
          },
          include: { user: true },
        })
      : await tx.companyUser.create({
          data: {
            companyId: invite.companyId,
            userId: user!.id,
            role: invite.role,
            status: "ACTIVE",
            isOwner: false,
          },
          include: { user: true },
        });

    await tx.companyInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });

    await tx.activityLog.create({
      data: {
        companyId: invite.companyId,
        userId: user!.id,
        action: "CREATE",
        module: "settings",
        message: `${user!.email} daveti kabul ederek şirkete katıldı.`,
      },
    });

    return companyUser;
  });

  return {
    companyUser: serializeCompanyUser(result),
    companyId: invite.companyId,
    companyName: invite.company.name,
    user: {
      id: user!.id,
      email: user!.email,
      role: user!.role,
    },
    redirectTo: "/dashboard" as const,
  };
}

export async function declineCompanyInvite(token: string) {
  const invite = await db.companyInvite.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invite) {
    throw new CompanyUsersError("Davet bulunamadı.", 404);
  }

  if (invite.status === "REJECTED") {
    return { companyName: invite.company.name };
  }

  if (invite.status === "ACCEPTED") {
    throw new CompanyUsersError("Bu davet zaten kabul edilmiş.", 400);
  }

  if (invite.status === "CANCELLED") {
    throw new CompanyUsersError("Bu davet iptal edilmiş.", 400);
  }

  if (invite.status !== "PENDING") {
    throw new CompanyUsersError("Bu davet artık geçerli değil.", 400);
  }

  if (isInviteExpired(invite.expiresAt)) {
    await db.companyInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    throw new CompanyUsersError("Davet süresi dolmuş.", 400);
  }

  await db.$transaction(async (tx) => {
    await tx.companyInvite.update({
      where: { id: invite.id },
      data: { status: "REJECTED" },
    });

    await tx.activityLog.create({
      data: {
        companyId: invite.companyId,
        userId: invite.invitedByUserId,
        action: "UPDATE",
        module: "settings",
        message: `${invite.email} daveti reddedildi.`,
      },
    });
  });

  return { companyName: invite.company.name };
}

export async function getInvitePreview(
  token: string,
  session?: { userId: string; email: string } | null
) {
  const invite = await db.companyInvite.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invite) {
    return null;
  }

  const expired = isInviteExpired(invite.expiresAt);
  const isLoggedIn = !!session?.userId;
  const loggedInEmail = session?.email ?? null;

  const accountExists = isLoggedIn
    ? false
    : !!(await db.user.findUnique({
        where: { email: normalizeInviteEmail(invite.email) },
        select: { id: true },
      }));

  const { mode, canAccept } = resolveInvitePreviewMode({
    inviteStatus: expired && invite.status === "PENDING" ? "EXPIRED" : invite.status,
    isExpired: expired,
    isLoggedIn,
    loggedInEmail,
    inviteEmail: invite.email,
    accountExists,
  });

  return {
    inviteId: invite.id,
    companyId: invite.companyId,
    companyName: invite.company.name,
    email: invite.email,
    role: invite.role,
    roleLabel: getUserRoleLabel(invite.role),
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    isExpired: expired,
    isLoggedIn,
    loggedInEmail,
    emailMatches:
      isLoggedIn &&
      !!loggedInEmail &&
      normalizeInviteEmail(loggedInEmail) === normalizeInviteEmail(invite.email),
    accountExists,
    canAccept,
    mode,
  };
}

function formatEmployeeName(employee: {
  firstName: string;
  lastName: string;
}) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export async function getEmployeesForUserCreation(input: {
  companyId: string;
  userId: string;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  const employees = await db.employee.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      companyUserId: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return employees.map((employee) => ({
    id: employee.id,
    name: formatEmployeeName(employee),
    email: employee.email,
    hasUserAccount: Boolean(employee.companyUserId),
  }));
}

export async function createCompanyUserFromEmployee(input: {
  companyId: string;
  userId: string;
  employeeId: string;
  email: string;
  password: string;
  role: AssignableCompanyUserRole;
  status?: "ACTIVE" | "PASSIVE";
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  const roleCheck = validateAssignableRole(input.role);
  if (!roleCheck.ok) {
    throw new CompanyUsersError(roleCheck.message, 400);
  }

  if (input.password.length < USER_PASSWORD_MIN_LENGTH) {
    throw new CompanyUsersError(
      `Şifre en az ${USER_PASSWORD_MIN_LENGTH} karakter olmalıdır.`,
      400
    );
  }

  const employee = await db.employee.findFirst({
    where: {
      id: input.employeeId,
      companyId: input.companyId,
    },
  });

  if (!employee) {
    throw new CompanyUsersError("Personel bulunamadı.", 404);
  }

  if (employee.status !== "ACTIVE") {
    throw new CompanyUsersError(
      "Pasif çalışan için kullanıcı oluşturulamaz.",
      400
    );
  }

  if (employee.companyUserId) {
    throw new CompanyUsersError(
      "Bu personele ait kullanıcı hesabı zaten var.",
      409
    );
  }

  const normalizedEmail = normalizeInviteEmail(input.email);
  if (!normalizedEmail) {
    throw new CompanyUsersError("E-posta zorunludur.", 400);
  }

  const displayName = formatEmployeeName(employee) || employee.firstName;
  const hashedPassword = await hashPassword(input.password);
  const targetStatus = input.status ?? "ACTIVE";

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const membership = await db.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.companyId,
          userId: existingUser.id,
        },
      },
    });

    if (
      membership &&
      (membership.status === "ACTIVE" || membership.status === "INVITED")
    ) {
      throw new CompanyUsersError("Bu e-posta adresi zaten kullanılıyor.", 400);
    }

    if (membership) {
      const linkedEmployee = await db.employee.findFirst({
        where: {
          companyId: input.companyId,
          companyUserId: membership.id,
          id: { not: employee.id },
        },
      });

      if (linkedEmployee) {
        throw new CompanyUsersError(
          "Bu e-posta adresi zaten kullanılıyor.",
          400
        );
      }
    }
  }

  const result = await db.$transaction(async (tx) => {
    let user = existingUser;

    if (!user) {
      user = await tx.user.create({
        data: {
          name: displayName,
          email: normalizedEmail,
          password: hashedPassword,
          role: "STAFF",
          status: "ACTIVE",
        },
      });
    } else {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          name: displayName,
        },
      });
    }

    const existingMembership = await tx.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.companyId,
          userId: user.id,
        },
      },
    });

    const companyUser = existingMembership
      ? await tx.companyUser.update({
          where: { id: existingMembership.id },
          data: {
            role: roleCheck.role,
            status: targetStatus,
            isOwner: false,
          },
        })
      : await tx.companyUser.create({
          data: {
            companyId: input.companyId,
            userId: user.id,
            role: roleCheck.role,
            status: targetStatus,
            isOwner: false,
          },
        });

    await tx.employee.update({
      where: { id: employee.id },
      data: {
        companyUserId: companyUser.id,
        email: normalizedEmail,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        module: "settings",
        message: `Kullanıcı oluşturuldu: ${displayName}`,
      },
    });

    return tx.companyUser.findUniqueOrThrow({
      where: { id: companyUser.id },
      include: {
        user: { select: { name: true, email: true, updatedAt: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  });

  return serializeCompanyUser(result);
}

export async function updateCompanyUserPassword(input: {
  companyId: string;
  userId: string;
  companyUserId: string;
  password: string;
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  if (input.password.length < USER_PASSWORD_MIN_LENGTH) {
    throw new CompanyUsersError(
      `Şifre en az ${USER_PASSWORD_MIN_LENGTH} karakter olmalıdır.`,
      400
    );
  }

  const target = await db.companyUser.findFirst({
    where: {
      id: input.companyUserId,
      companyId: input.companyId,
    },
    include: {
      user: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  if (!target) {
    throw new CompanyUsersError("Kullanıcı bulunamadı.", 404);
  }

  if (target.isOwner || target.role === "OWNER") {
    throw new CompanyUsersError("Firma sahibinin şifresi buradan değiştirilemez.", 403);
  }

  const hashedPassword = await hashPassword(input.password);
  const displayName = target.employee
    ? formatEmployeeName(target.employee)
    : target.user.name;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.userId },
      data: { password: hashedPassword },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: `Kullanıcı şifresi güncellendi: ${displayName}`,
      },
    });
  });

  return { success: true };
}

export async function updateCompanyUserStatus(input: {
  companyId: string;
  userId: string;
  companyUserId: string;
  status: "ACTIVE" | "PASSIVE";
}) {
  const actor = await getActiveCompanyUser(input.userId, input.companyId);
  const target = await getCompanyUserInCompany(input.companyUserId, input.companyId);

  const permission = validateActorCanManageUsers({
    actorRole: actor.role,
    actorIsOwner: actor.isOwner,
  });

  if (!permission.ok) {
    throw new CompanyUsersError(permission.message, 403);
  }

  if (target.isOwner || target.role === "OWNER") {
    throw new CompanyUsersError("Firma sahibinin durumu değiştirilemez.", 403);
  }

  if (target.userId === input.userId && input.status === "PASSIVE") {
    throw new CompanyUsersError("Kendi hesabınızı pasif yapamazsınız.", 403);
  }

  const updated = await db.$transaction(async (tx) => {
    const companyUser = await tx.companyUser.update({
      where: { id: target.id },
      data: { status: input.status },
      include: {
        user: { select: { name: true, email: true, updatedAt: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: `${companyUser.user.email} kullanıcısı ${
          input.status === "ACTIVE" ? "aktif" : "pasif"
        } yapıldı.`,
      },
    });

    return companyUser;
  });

  return serializeCompanyUser(updated);
}
