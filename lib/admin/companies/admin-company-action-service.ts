import { db } from "@/lib/prisma";
import { logAdminCompanyAudit } from "@/lib/admin/companies/admin-company-audit";
import { invalidateAdminCompanyCaches } from "@/lib/admin/companies/admin-company-cache";
import {
  archiveCompanySchema,
  extendCompanyTrialSchema,
  reactivateCompanySchema,
  suspendCompanySchema,
} from "@/lib/admin/companies/admin-company-schemas";
import { extendSubscriptionTrial } from "@/lib/admin-subscription-service";

export class AdminCompanyActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminCompanyActionError";
    this.status = status;
  }
}

async function getCompanyOrThrow(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: true,
      users: {
        where: { isOwner: true },
        include: { user: true },
        take: 1,
      },
    },
  });

  if (!company) {
    throw new AdminCompanyActionError("Firma bulunamadı.", 404);
  }

  return company;
}

export async function suspendAdminCompany(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = suspendCompanySchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyActionError(parsed.error.issues[0]?.message ?? "Geçersiz veri.");
  }

  const company = await getCompanyOrThrow(companyId);
  if (company.status === "SUSPENDED") {
    throw new AdminCompanyActionError("Firma zaten askıya alınmış.");
  }

  const before = {
    status: company.status,
    suspendedAt: company.suspendedAt,
  };

  await db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendedReason: parsed.data.reason,
        suspendedUntil: parsed.data.suspendedUntil
          ? new Date(parsed.data.suspendedUntil)
          : null,
        suspendedByUserId: actorUserId,
      },
    });

    await tx.adminCompanyNote.create({
      data: {
        companyId,
        authorUserId: actorUserId,
        content: parsed.data.internalNote,
        category: "SUPPORT",
        priority: "HIGH",
      },
    });
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "COMPANY_SUSPENDED",
    reason: parsed.data.reason,
    before,
    after: { status: "SUSPENDED" },
  });

  invalidateAdminCompanyCaches(companyId);
  return { success: true };
}

export async function reactivateAdminCompany(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = reactivateCompanySchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyActionError(parsed.error.issues[0]?.message ?? "Geçersiz veri.");
  }

  const company = await getCompanyOrThrow(companyId);
  if (company.status !== "SUSPENDED") {
    throw new AdminCompanyActionError("Yalnızca askıdaki firmalar yeniden etkinleştirilebilir.");
  }

  const before = { status: company.status };

  await db.company.update({
    where: { id: companyId },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspendedReason: null,
      suspendedUntil: null,
      suspendedByUserId: null,
    },
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "COMPANY_REACTIVATED",
    reason: parsed.data.reason,
    before,
    after: { status: "ACTIVE" },
  });

  invalidateAdminCompanyCaches(companyId);
  return { success: true };
}

export async function extendAdminCompanyTrial(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = extendCompanyTrialSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyActionError(parsed.error.issues[0]?.message ?? "Geçersiz veri.");
  }

  const company = await getCompanyOrThrow(companyId);
  if (!company.subscription) {
    throw new AdminCompanyActionError("Firmanın aboneliği bulunamadı.");
  }

  await extendSubscriptionTrial(company.subscription.id, actorUserId, {
    mode: parsed.data.mode,
    customDate: parsed.data.customDate,
    reason: parsed.data.reason,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "TRIAL_EXTENDED",
    reason: parsed.data.reason,
    metadata: {
      mode: parsed.data.mode,
      notifyOwner: parsed.data.notifyOwner ?? false,
    },
  });

  invalidateAdminCompanyCaches(companyId);
  return { success: true };
}

export async function sendOwnerPasswordReset(
  _companyId: string,
  _actorUserId: string
): Promise<never> {
  // Mail altyapısı yapılandırılmamış; token üretilmez, link dönmez.
  throw new AdminCompanyActionError(
    "E-posta altyapısı yapılandırılmamış. Parola sıfırlama e-postası gönderilemez.",
    503
  );
}

export async function resendOwnerInvite(
  _companyId: string,
  _actorUserId: string
): Promise<never> {
  // Mail altyapısı yapılandırılmamış; invite token üretilmez, link dönmez.
  throw new AdminCompanyActionError(
    "E-posta altyapısı yapılandırılmamış. Davet e-postası gönderilemez.",
    503
  );
}

export async function archiveAdminCompany(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = archiveCompanySchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminCompanyActionError(parsed.error.issues[0]?.message ?? "Geçersiz veri.");
  }

  const company = await getCompanyOrThrow(companyId);
  if (company.name !== parsed.data.confirmName) {
    throw new AdminCompanyActionError("Onay için firma adı eşleşmiyor.");
  }

  const blockers: string[] = [];
  const [pendingPayment, pendingPartner, activeBillingRun] = await Promise.all([
    db.membershipPayment.count({
      where: {
        companyId,
        status: { in: ["PENDING", "WAIT_CALLBACK"] },
      },
    }),
    db.partnerEarning.count({
      where: {
        status: "PENDING",
        membershipPayment: { companyId },
      },
    }),
    db.subscriptionBillingRun.count({
      where: { companyId, status: { in: ["PROCESSING", "FAILED"] } },
    }),
  ]);

  if (
    company.subscription &&
    ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD"].includes(company.subscription.status)
  ) {
    blockers.push("Aktif abonelik");
  }
  if (pendingPayment > 0) blockers.push("Bekleyen ödeme");
  if (pendingPartner > 0) blockers.push("Bekleyen partner komisyonu");
  if (activeBillingRun > 0) blockers.push("Devam eden faturalama işi");

  if (blockers.length > 0) {
    throw new AdminCompanyActionError(
      `Arşivleme engellendi: ${blockers.join(", ")}`
    );
  }

  await db.company.update({
    where: { id: companyId },
    data: {
      status: "PASSIVE",
      archivedAt: new Date(),
      archivedByUserId: actorUserId,
    },
  });

  await logAdminCompanyAudit({
    actorUserId,
    companyId,
    action: "COMPANY_ARCHIVED",
    reason: parsed.data.reason,
    metadata: { blockersChecked: true },
  });

  invalidateAdminCompanyCaches(companyId);
  return { success: true };
}
