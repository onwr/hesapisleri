import "server-only";

import type { PartnerBadgeType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildReferralUrl } from "@/lib/partner-cookie";
import {
  ensurePartnerSettings,
  linkPartnerUserByEmail,
} from "@/lib/partner-conversion-service";
import {
  generateReferralCode,
  normalizePartnerEmail,
  sanitizeReferralCode,
} from "@/lib/partner-utils";
import { AdminPartnerApplicationServiceError } from "@/lib/admin/partner-applications/admin-partner-application-errors";
import { logAdminPartnerApplicationAudit } from "@/lib/admin/partner-applications/admin-partner-application-audit-service";
import { invalidateAdminPartnerApplicationCaches } from "@/lib/admin/partner-applications/admin-partner-application-cache";
import {
  assertApplicationPending,
  assertValidStatusTransition,
} from "@/lib/admin/partner-applications/admin-partner-application-issue-service";
import {
  adminPartnerApplicationApproveSchema,
  adminPartnerApplicationRejectSchema,
  assertNoForbiddenApplicationDecisionKeys,
} from "@/lib/admin/partner-applications/admin-partner-application-schemas";

function serializePartnerSummary(partner: {
  id: string;
  fullName: string;
  email: string;
  referralCode: string;
  status: string;
  commissionRate: { toString(): string };
}) {
  return {
    id: partner.id,
    fullName: partner.fullName,
    email: partner.email,
    referralCode: partner.referralCode,
    referralUrl: buildReferralUrl(partner.referralCode),
    status: partner.status,
    commissionRate: Number(partner.commissionRate),
  };
}

export async function approvePartnerApplicationAdmin(
  applicationId: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenApplicationDecisionKeys(body);
  const parsed = adminPartnerApplicationApproveSchema.parse(body);

  const result = await db.$transaction(async (tx) => {
    const application = await tx.partnerApplication.findUnique({
      where: { id: applicationId },
      include: { profile: true },
    });

    if (!application) {
      throw new AdminPartnerApplicationServiceError("Başvuru bulunamadı.", 404);
    }

    const pending = assertApplicationPending(application.status);
    if (!pending.ok) {
      throw new AdminPartnerApplicationServiceError(pending.issues[0]!.message, 400, pending.issues[0]!.code);
    }

    const transition = assertValidStatusTransition(application.status, "APPROVED");
    if (!transition.ok) {
      throw new AdminPartnerApplicationServiceError(transition.issues[0]!.message, 400);
    }

    const settings = await ensurePartnerSettings();
    const email = normalizePartnerEmail(application.email);
    const now = new Date();

    let referralCode = parsed.referralCode
      ? sanitizeReferralCode(parsed.referralCode)
      : generateReferralCode(application.fullName);
    if (!referralCode) referralCode = generateReferralCode("PARTNER");

    const existingByEmail = await tx.partnerProfile.findFirst({
      where: { email },
    });

    if (existingByEmail) {
      if (existingByEmail.applicationId && existingByEmail.applicationId !== application.id) {
        throw new AdminPartnerApplicationServiceError(
          "Bu e-posta ile kayıtlı partner profili zaten var.",
          409,
          "EXISTING_PARTNER_PROFILE"
        );
      }

      if (parsed.referralCode) {
        const codeDup = await tx.partnerProfile.findFirst({
          where: { referralCode, id: { not: existingByEmail.id } },
        });
        if (codeDup) {
          throw new AdminPartnerApplicationServiceError(
            "Referans kodu başka bir partnerde kayıtlı.",
            409,
            "REFERRAL_CODE_ALREADY_EXISTS"
          );
        }
        await tx.partnerProfile.update({
          where: { id: existingByEmail.id },
          data: { referralCode },
        });
      }

      await tx.partnerApplication.update({
        where: { id: applicationId },
        data: {
          status: "APPROVED",
          reviewedByUserId: actorUserId,
          reviewedAt: now,
        },
      });

      if (!existingByEmail.applicationId) {
        await tx.partnerProfile.update({
          where: { id: existingByEmail.id },
          data: { applicationId: application.id },
        });
      }

      await linkPartnerUserByEmail(tx, existingByEmail.id, email);

      await logAdminPartnerApplicationAudit({
        userId: actorUserId,
        action: "PARTNER_APPLICATION_APPROVED",
        applicationId,
        partnerId: existingByEmail.id,
        displayMessage: `Başvuru onaylandı (mevcut profil): ${application.fullName}`,
        metadata: { reason: parsed.reason },
        tx,
      });

      const refreshed = await tx.partnerProfile.findUniqueOrThrow({
        where: { id: existingByEmail.id },
      });
      return { partner: refreshed, created: false };
    }

    const emailDupApp = await tx.partnerApplication.findFirst({
      where: { email: application.email, id: { not: application.id }, status: "PENDING" },
    });
    if (emailDupApp) {
      throw new AdminPartnerApplicationServiceError(
        "Aynı e-posta ile bekleyen başka başvuru var.",
        409,
        "DUPLICATE_EMAIL"
      );
    }

    const codeTaken = await tx.partnerProfile.findFirst({ where: { referralCode } });
    if (codeTaken) {
      throw new AdminPartnerApplicationServiceError(
        "Referans kodu başka bir partnerde kayıtlı.",
        409,
        "REFERRAL_CODE_ALREADY_EXISTS"
      );
    }

    const created = await tx.partnerProfile.create({
      data: {
        applicationId: application.id,
        fullName: application.fullName,
        email,
        phone: application.phone,
        referralCode,
        commissionRate: parsed.commissionRate ?? Number(settings.defaultCommissionRate),
        status: "PASSIVE",
        badgeType: (parsed.badgeType ?? "PARTNER") as PartnerBadgeType,
        badgeLabel: parsed.badgeLabel ?? null,
        notes: parsed.notes?.trim() || null,
      },
    });

    await tx.partnerApplication.update({
      where: { id: applicationId },
      data: {
        status: "APPROVED",
        reviewedByUserId: actorUserId,
        reviewedAt: now,
      },
    });

    await linkPartnerUserByEmail(tx, created.id, email);

    await logAdminPartnerApplicationAudit({
      userId: actorUserId,
      action: "PARTNER_APPLICATION_APPROVED",
      applicationId,
      partnerId: created.id,
      displayMessage: `Başvuru onaylandı: ${application.fullName}`,
      metadata: { reason: parsed.reason },
      tx,
    });

    await logAdminPartnerApplicationAudit({
      userId: actorUserId,
      action: "PARTNER_CREATED_FROM_APPLICATION",
      applicationId,
      partnerId: created.id,
      displayMessage: `Başvurudan partner oluşturuldu: ${created.referralCode}`,
      metadata: { reason: parsed.reason },
      tx,
    });

    return { partner: created, created: true };
  });

  invalidateAdminPartnerApplicationCaches(result.partner.id);

  return {
    partner: serializePartnerSummary(result.partner),
    createdProfile: result.created,
    message: result.created
      ? "Başvuru onaylandı ve partner profili oluşturuldu."
      : "Başvuru onaylandı; mevcut partner profiline bağlandı.",
  };
}

export async function rejectPartnerApplicationAdmin(
  applicationId: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenApplicationDecisionKeys(body);
  const parsed = adminPartnerApplicationRejectSchema.parse(body);

  await db.$transaction(async (tx) => {
    const application = await tx.partnerApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new AdminPartnerApplicationServiceError("Başvuru bulunamadı.", 404);
    }

    const pending = assertApplicationPending(application.status);
    if (!pending.ok) {
      throw new AdminPartnerApplicationServiceError(pending.issues[0]!.message, 400, pending.issues[0]!.code);
    }

    const transition = assertValidStatusTransition(application.status, "REJECTED");
    if (!transition.ok) {
      throw new AdminPartnerApplicationServiceError(transition.issues[0]!.message, 400);
    }

    await tx.partnerApplication.update({
      where: { id: applicationId },
      data: {
        status: "REJECTED",
        rejectionReason: parsed.reason.trim(),
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    await logAdminPartnerApplicationAudit({
      userId: actorUserId,
      action: "PARTNER_APPLICATION_REJECTED",
      applicationId,
      displayMessage: `Başvuru reddedildi: ${application.fullName}`,
      metadata: { reason: parsed.reason },
      tx,
    });
  });

  invalidateAdminPartnerApplicationCaches();

  return { message: "Başvuru reddedildi." };
}
