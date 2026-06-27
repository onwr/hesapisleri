import { db } from "@/lib/prisma";
import { logAdminUserAudit } from "@/lib/admin/users/admin-user-audit";
import {
  adminUserReactivateSchema,
  adminUserSuspendSchema,
} from "@/lib/admin/users/admin-user-schemas";

export class AdminUserActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminUserActionError";
    this.status = status;
  }
}

async function getUserOrThrow(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserActionError("Kullanıcı bulunamadı.", 404);
  return user;
}

export async function adminSuspendUser(
  targetUserId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserSuspendSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminUserActionError(
      parsed.error.issues[0]?.message ?? "Geçersiz veri."
    );
  }

  const user = await getUserOrThrow(targetUserId);

  if (user.status !== "ACTIVE") {
    throw new AdminUserActionError(
      "Yalnızca aktif kullanıcılar askıya alınabilir. PASSIVE ve zaten askıda olan kullanıcılar bu işlemle değiştirilemez."
    );
  }

  if (actorUserId === targetUserId) {
    throw new AdminUserActionError("Kendi hesabınızı askıya alamazsınız.");
  }

  // Son SUPER_ADMIN kontrolü
  if (user.role === "SUPER_ADMIN") {
    const superAdminCount = await db.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    if (superAdminCount <= 1) {
      throw new AdminUserActionError(
        "Son platform yöneticisi askıya alınamaz."
      );
    }
  }

  // Bu kullanıcının son aktif OWNER olduğu firmalar
  const lastOwnerFirms = await db.companyUser.findMany({
    where: {
      userId: targetUserId,
      isOwner: true,
      status: "ACTIVE",
    },
    select: { companyId: true },
  });

  for (const { companyId } of lastOwnerFirms) {
    const otherActiveOwners = await db.companyUser.count({
      where: {
        companyId,
        isOwner: true,
        status: "ACTIVE",
        userId: { not: targetUserId },
      },
    });
    if (otherActiveOwners === 0) {
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      throw new AdminUserActionError(
        `Kullanıcı "${company?.name ?? companyId}" firmasının tek aktif sahibidir. Önce firma sahipliğini başka birine devredin.`
      );
    }
  }

  const before = { status: user.status };

  await db.user.update({
    where: { id: targetUserId },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendedReason: parsed.data.reason,
      suspendedUntil: parsed.data.suspendedUntil
        ? new Date(parsed.data.suspendedUntil)
        : null,
      suspendedByAdminId: actorUserId,
    },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId,
    action: "USER_SUSPENDED",
    reason: parsed.data.reason,
    before,
    after: { status: "SUSPENDED" },
  });

  return { success: true };
}

export async function adminReactivateUser(
  targetUserId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserReactivateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminUserActionError(
      parsed.error.issues[0]?.message ?? "Geçersiz veri."
    );
  }

  const user = await getUserOrThrow(targetUserId);

  if (user.status !== "SUSPENDED") {
    throw new AdminUserActionError(
      "Yalnızca askıya alınmış kullanıcılar yeniden etkinleştirilebilir."
    );
  }

  const before = { status: user.status };

  await db.user.update({
    where: { id: targetUserId },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspendedReason: null,
      suspendedUntil: null,
      suspendedByAdminId: null,
    },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId,
    action: "USER_REACTIVATED",
    reason: parsed.data.reason,
    before,
    after: { status: "ACTIVE" },
  });

  return { success: true };
}

export async function adminRevokeUserSessions(
  targetUserId: string,
  actorUserId: string
) {
  await getUserOrThrow(targetUserId);

  await db.user.update({
    where: { id: targetUserId },
    data: { sessionVersion: { increment: 1 } },
  });

  await logAdminUserAudit({
    actorUserId,
    targetUserId,
    action: "USER_SESSIONS_REVOKED",
    metadata: { selfRevoke: actorUserId === targetUserId },
  });

  return {
    success: true,
    selfRevoked: actorUserId === targetUserId,
  };
}

// Mail altyapısı yapılandırılmamış; token üretilmez.
export async function adminSendUserPasswordReset(
  _targetUserId: string,
  _actorUserId: string
): Promise<never> {
  throw new AdminUserActionError(
    "E-posta altyapısı yapılandırılmamış. Parola sıfırlama e-postası gönderilemez.",
    503
  );
}

// Mail altyapısı yapılandırılmamış; verification token üretilmez.
export async function adminResendVerification(
  _targetUserId: string,
  _actorUserId: string
): Promise<never> {
  throw new AdminUserActionError(
    "E-posta altyapısı yapılandırılmamış. Doğrulama e-postası gönderilemez.",
    503
  );
}
