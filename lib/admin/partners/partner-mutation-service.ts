import "server-only";

import type { PartnerBadgeType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildReferralUrl } from "@/lib/partner-cookie";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { AdminPartnerServiceError } from "@/lib/admin/partners/admin-partner-errors";
import {
  adminPartnerCreateSchema,
  adminPartnerLifecycleSchema,
  adminPartnerUpdateSchema,
  assertNoForbiddenPartnerCreateKeys,
  assertNoForbiddenPartnerPatchKeys,
} from "@/lib/admin/partners/admin-partner-schemas";
import { logAdminPartnerAudit } from "@/lib/admin/partners/admin-partner-audit-service";
import { invalidateAdminPartnerCaches } from "@/lib/admin/partners/admin-partner-cache";
import { assertPartnerActivationAllowed } from "@/lib/admin/partners/admin-partner-issue-service";
import {
  generateReferralCode,
  normalizePartnerEmail,
  sanitizeReferralCode,
} from "@/lib/partner-utils";

export async function createPartner(actorUserId: string, input: Record<string, unknown>) {
  assertNoForbiddenPartnerCreateKeys(input);
  const parsed = adminPartnerCreateSchema.parse(input);
  const email = normalizePartnerEmail(parsed.email);

  let referralCode = parsed.referralCode
    ? sanitizeReferralCode(parsed.referralCode)
    : generateReferralCode(parsed.fullName);
  if (!referralCode) referralCode = generateReferralCode("PARTNER");

  const settings = await ensurePartnerSettings();

  const partner = await db.$transaction(async (tx) => {
    const existingEmail = await tx.partnerProfile.findFirst({ where: { email } });
    if (existingEmail) {
      throw new AdminPartnerServiceError("Bu e-posta ile kayıtlı partner var.", 409);
    }

    const codeTaken = await tx.partnerProfile.findFirst({ where: { referralCode } });
    if (codeTaken) {
      throw new AdminPartnerServiceError("Referans kodu başka bir partnerde kayıtlı.", 409);
    }

    const row = await tx.partnerProfile.create({
      data: {
        fullName: parsed.fullName.trim(),
        email,
        phone: parsed.phone?.trim() || null,
        referralCode,
        commissionRate: parsed.commissionRate ?? Number(settings.defaultCommissionRate),
        status: "PASSIVE",
        badgeType: parsed.badgeType as PartnerBadgeType,
        badgeLabel: parsed.badgeLabel?.trim() || null,
        payoutMethod: parsed.payoutMethod ?? null,
        iban: parsed.iban?.trim() || null,
        bankName: parsed.bankName?.trim() || null,
        accountHolderName: parsed.accountHolderName?.trim() || null,
        taxNumber: parsed.taxNumber?.trim() || null,
        notes: parsed.notes?.trim() || null,
      },
    });

    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_CREATED",
      partnerId: row.id,
      displayMessage: `Partner oluşturuldu: ${row.referralCode}`,
      metadata: { reason: parsed.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminPartnerCaches(partner.id);
  return serializePartnerRow(partner);
}

export async function updatePartner(
  id: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenPartnerPatchKeys(input);
  const parsed = adminPartnerUpdateSchema.parse(input);

  const before = await db.partnerProfile.findUnique({ where: { id } });
  if (!before) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);
  if (before.status === "ARCHIVED") {
    throw new AdminPartnerServiceError("Arşivlenmiş partner güncellenemez.", 400);
  }

  const nextReferralCode =
    parsed.referralCode !== undefined ? sanitizeReferralCode(parsed.referralCode) : undefined;
  if (nextReferralCode !== undefined && !nextReferralCode) {
    throw new AdminPartnerServiceError("Geçerli bir referans kodu girin.", 400);
  }

  const updated = await db.$transaction(async (tx) => {
    if (parsed.email) {
      const email = normalizePartnerEmail(parsed.email);
      const dup = await tx.partnerProfile.findFirst({
        where: { email, id: { not: id } },
      });
      if (dup) throw new AdminPartnerServiceError("E-posta başka partnerde kayıtlı.", 409);
    }

    if (nextReferralCode) {
      const codeDup = await tx.partnerProfile.findFirst({
        where: { referralCode: nextReferralCode, id: { not: id } },
      });
      if (codeDup) {
        throw new AdminPartnerServiceError("Referans kodu başka bir partnerde kayıtlı.", 409);
      }
    }

    const row = await tx.partnerProfile.update({
      where: { id },
      data: {
        ...(parsed.fullName !== undefined ? { fullName: parsed.fullName.trim() } : {}),
        ...(parsed.email !== undefined ? { email: normalizePartnerEmail(parsed.email) } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone?.trim() || null } : {}),
        ...(nextReferralCode !== undefined ? { referralCode: nextReferralCode } : {}),
        ...(parsed.accountHolderName !== undefined
          ? { accountHolderName: parsed.accountHolderName?.trim() || null }
          : {}),
        ...(parsed.taxNumber !== undefined ? { taxNumber: parsed.taxNumber?.trim() || null } : {}),
        ...(parsed.iban !== undefined ? { iban: parsed.iban?.trim() || null } : {}),
        ...(parsed.bankName !== undefined ? { bankName: parsed.bankName?.trim() || null } : {}),
        ...(parsed.badgeType !== undefined ? { badgeType: parsed.badgeType } : {}),
        ...(parsed.badgeLabel !== undefined ? { badgeLabel: parsed.badgeLabel?.trim() || null } : {}),
        ...(parsed.commissionRate !== undefined ? { commissionRate: parsed.commissionRate } : {}),
        ...(parsed.payoutMethod !== undefined ? { payoutMethod: parsed.payoutMethod } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes?.trim() || null } : {}),
      },
    });

    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_UPDATED",
      partnerId: id,
      displayMessage: `Partner güncellendi: ${row.referralCode}`,
      metadata: { reason: parsed.reason ?? null, fields: Object.keys(parsed) },
      tx,
    });

    return row;
  });

  invalidateAdminPartnerCaches(id);
  return serializePartnerRow(updated);
}

export async function activatePartner(
  id: string,
  actorUserId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminPartnerLifecycleSchema.parse(body) : undefined;

  const partner = await db.partnerProfile.findUnique({ where: { id } });
  if (!partner) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);
  if (partner.status === "ARCHIVED") {
    throw new AdminPartnerServiceError("Arşivlenmiş partner aktifleştirilemez.", 400);
  }

  const referralCodeDuplicate = partner.referralCode
    ? Boolean(
        await db.partnerProfile.findFirst({
          where: { referralCode: partner.referralCode, id: { not: id } },
        })
      )
    : false;

  const activation = assertPartnerActivationAllowed({ partner, referralCodeDuplicate });
  if (!activation.ok) {
    throw new AdminPartnerServiceError(activation.issues[0]?.message ?? "Aktivasyon engellendi.", 400);
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.partnerProfile.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_ACTIVATED",
      partnerId: id,
      displayMessage: `Partner aktifleştirildi: ${row.referralCode}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminPartnerCaches(id);
  return serializePartnerRow(updated);
}

export async function suspendPartner(
  id: string,
  actorUserId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminPartnerLifecycleSchema.parse(body) : undefined;

  const partner = await db.partnerProfile.findUnique({ where: { id } });
  if (!partner) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.partnerProfile.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_SUSPENDED",
      partnerId: id,
      displayMessage: `Partner askıya alındı: ${row.referralCode}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminPartnerCaches(id);
  return serializePartnerRow(updated);
}

export async function archivePartner(
  id: string,
  actorUserId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminPartnerLifecycleSchema.parse(body) : undefined;

  const partner = await db.partnerProfile.findUnique({ where: { id } });
  if (!partner) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.partnerProfile.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    await logAdminPartnerAudit({
      userId: actorUserId,
      action: "PARTNER_ARCHIVED",
      partnerId: id,
      displayMessage: parsed?.reason ?? `Partner arşivlendi: ${row.referralCode}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminPartnerCaches(id);
  return serializePartnerRow(updated);
}

function serializePartnerRow(partner: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  referralCode: string;
  commissionRate: { toString(): string };
  status: string;
  badgeType: string;
  badgeLabel: string | null;
  iban: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  taxNumber?: string | null;
  createdAt?: Date;
  notes?: string | null;
}) {
  return {
    id: partner.id,
    fullName: partner.fullName,
    email: partner.email,
    phone: partner.phone,
    referralCode: partner.referralCode,
    referralUrl: buildReferralUrl(partner.referralCode),
    commissionRate: Number(partner.commissionRate),
    status: partner.status,
    badgeType: partner.badgeType,
    badgeLabel: partner.badgeLabel,
    payoutInfo: {
      iban: partner.iban,
      bankName: partner.bankName,
      accountHolderName: partner.accountHolderName,
      taxNumber: partner.taxNumber ?? null,
    },
    notes: partner.notes ?? null,
    createdAt: partner.createdAt?.toISOString(),
  };
}
