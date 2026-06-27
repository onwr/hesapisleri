import { db } from "@/lib/prisma";
import { logAdminUserAudit } from "@/lib/admin/users/admin-user-audit";
import { adminUserMembershipPatchSchema } from "@/lib/admin/users/admin-user-schemas";

export class AdminUserMembershipError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminUserMembershipError";
    this.status = status;
  }
}

export async function adminUpdateCompanyMembership(
  targetUserId: string,
  companyUserId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserMembershipPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminUserMembershipError(
      parsed.error.issues[0]?.message ?? "Geçersiz veri."
    );
  }

  const membership = await db.companyUser.findFirst({
    where: { id: companyUserId, userId: targetUserId },
  });
  if (!membership) {
    throw new AdminUserMembershipError("Üyelik bulunamadı.", 404);
  }

  // isOwner=true olan üyelikte hiçbir değişiklik yapılamaz (bu fazda transfer yok).
  if (membership.isOwner) {
    throw new AdminUserMembershipError(
      "Firma sahibinin üyeliği bu arayüzden değiştirilemez. Sahiplik transferi bu fazda desteklenmemektedir."
    );
  }

  const { status, role } = parsed.data;

  // Pasife alma: son aktif OWNER kontrolü (isOwner=false olduğu için bu blok gereksiz
  // ama katmanlı savunma olarak bırakılıyor — future-proof)
  if (status === "PASSIVE" && membership.status === "ACTIVE") {
    const otherOwners = await db.companyUser.count({
      where: {
        companyId: membership.companyId,
        isOwner: true,
        status: "ACTIVE",
        id: { not: companyUserId },
      },
    });
    if (otherOwners === 0) {
      throw new AdminUserMembershipError(
        "Bu üyelik pasife alınırsa firmanın aktif sahibi kalmaz."
      );
    }
  }

  const before = { status: membership.status, role: membership.role };

  await db.companyUser.update({
    where: { id: companyUserId },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(role !== undefined ? { role } : {}),
    },
  });

  if (status !== undefined && status !== membership.status) {
    const action =
      status === "PASSIVE"
        ? "USER_COMPANY_MEMBERSHIP_DEACTIVATED"
        : "USER_COMPANY_MEMBERSHIP_REACTIVATED";
    await logAdminUserAudit({
      actorUserId,
      targetUserId,
      action,
      before,
      after: { status },
      metadata: { companyId: membership.companyId, companyUserId },
    });
  }

  if (role !== undefined && role !== membership.role) {
    await logAdminUserAudit({
      actorUserId,
      targetUserId,
      action: "USER_COMPANY_ROLE_UPDATED",
      before,
      after: { role },
      metadata: { companyId: membership.companyId, companyUserId },
    });
  }

  return { success: true };
}

// Mail altyapısı yapılandırılmamış; davet token yenilenmez.
export async function adminResendMembershipInvite(
  _targetUserId: string,
  _companyUserId: string,
  _actorUserId: string
): Promise<never> {
  throw new AdminUserMembershipError(
    "E-posta altyapısı yapılandırılmamış. Davet e-postası gönderilemez.",
    503
  );
}
