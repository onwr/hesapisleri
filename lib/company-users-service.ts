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
import { resolveInvitePreviewMode } from "@/lib/invite-preview-utils";
import { getUserRoleLabel } from "@/lib/settings-utils";
import { SettingsAccessError } from "@/lib/settings-service";

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

function serializeCompanyUser(entry: CompanyUser & { user: { name: string; email: string } }) {
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
      include: { user: true },
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
      include: { user: true },
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
