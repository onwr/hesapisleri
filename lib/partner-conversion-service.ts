import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  calculatePartnerCommission,
  normalizePartnerEmail,
} from "@/lib/partner-utils";

export async function ensurePartnerSettings() {
  const existing = await db.partnerSettings.findUnique({
    where: { id: "default" },
  });

  if (existing) return existing;

  return db.partnerSettings.create({
    data: { id: "default" },
  });
}

async function getActivePartnerById(partnerId: string) {
  return db.partnerProfile.findFirst({
    where: { id: partnerId, status: "ACTIVE" },
  });
}

async function getActivePartnerByCode(code: string) {
  return db.partnerProfile.findFirst({
    where: {
      referralCode: code.toUpperCase(),
      status: "ACTIVE",
    },
  });
}

export async function resolvePartnerFromAttribution(input: {
  partnerId?: string | null;
  referralCode?: string | null;
}) {
  if (input.partnerId) {
    const partner = await getActivePartnerById(input.partnerId);
    if (partner) return partner;
  }

  if (input.referralCode) {
    return getActivePartnerByCode(input.referralCode);
  }

  return null;
}

export async function createPartnerSignupConversion(input: {
  companyId: string;
  userId: string;
  partnerId: string;
  referralCode: string;
  clickId?: string | null;
  source?: "COOKIE" | "REFERRAL_CODE";
}) {
  const partner = await getActivePartnerById(input.partnerId);
  if (!partner) return null;

  // Self-referral engeli — ortak kendi koduyla kendi hesabına/şirketine
  // referans veremez (komisyon/güvenlik istismarını önler).
  if (partner.userId && partner.userId === input.userId) {
    console.warn("PARTNER_SELF_REFERRAL_BLOCKED", {
      partnerId: partner.id,
      userId: input.userId,
    });
    return null;
  }

  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: input.companyId },
      data: {
        referringPartnerId: partner.id,
        referralCode: input.referralCode,
        referredAt: now,
      },
    });

    if (input.clickId) {
      await tx.partnerReferralClick.updateMany({
        where: { id: input.clickId, partnerId: partner.id },
        data: {
          convertedCompanyId: input.companyId,
          convertedUserId: input.userId,
          convertedAt: now,
        },
      });
    }

    const conversion = await tx.partnerConversion.create({
      data: {
        partnerId: partner.id,
        clickId: input.clickId ?? null,
        companyId: input.companyId,
        userId: input.userId,
        type: "SIGNUP",
        amount: 0,
        commissionRate: partner.commissionRate,
        commissionAmount: 0,
        status: "APPROVED",
        source: input.source ?? "COOKIE",
        occurredAt: now,
        approvedAt: now,
      },
    });

    return conversion;
  });
}

export async function createPartnerPaymentConversion(input: {
  companyId: string;
  paymentAmount: number;
  membershipPaymentId?: string;
}) {
  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { referringPartnerId: true, referralCode: true },
  });

  if (!company?.referringPartnerId) return null;

  const partner = await getActivePartnerById(company.referringPartnerId);
  if (!partner) return null;

  if (input.membershipPaymentId) {
    const existingEarning = await (db.partnerEarning as any).findUnique({
      where: { membershipPaymentId: input.membershipPaymentId },
    });
    if (existingEarning) return null;
  }

  const settings = await ensurePartnerSettings();

  const previousPaidCount = await db.membershipPayment.count({
    where: {
      companyId: input.companyId,
      status: "PAID",
      provider: { not: "TRIAL" },
    },
  });

  const isRenewal = previousPaidCount > 1;
  if (isRenewal && !settings.commissionOnRenewals) {
    return null;
  }

  const conversionType = isRenewal ? "RENEWAL" : "PAID_MEMBERSHIP";
  const commissionRate = Number(partner.commissionRate);
  const commissionAmount = calculatePartnerCommission(
    input.paymentAmount,
    commissionRate
  );

  if (commissionAmount <= 0) return null;

  const autoApprove = settings.autoApproveConversions;
  const now = new Date();

  return db.$transaction(async (tx) => {
    const conversion = await tx.partnerConversion.create({
      data: {
        partnerId: partner.id,
        companyId: input.companyId,
        type: conversionType,
        amount: input.paymentAmount,
        commissionRate,
        commissionAmount,
        status: autoApprove ? "APPROVED" : "PENDING",
        source: "COOKIE",
        occurredAt: now,
        approvedAt: autoApprove ? now : null,
      },
    });

    const earningStatus = autoApprove ? "APPROVED" : "PENDING";

    await tx.partnerEarning.create({
      data: {
        partnerId: partner.id,
        conversionId: conversion.id,
        membershipPaymentId: input.membershipPaymentId,
        amount: commissionAmount,
        currency: "TRY",
        status: earningStatus,
        description: isRenewal
          ? `Üyelik yenileme komisyonu${input.membershipPaymentId ? ` · ${input.membershipPaymentId}` : ""}`
          : `Üyelik ödemesi komisyonu${input.membershipPaymentId ? ` · ${input.membershipPaymentId}` : ""}`,
        availableAt: autoApprove ? now : null,
      } as any,
    });

    return conversion;
  });
}

export async function linkPartnerUserByEmail(
  tx: Prisma.TransactionClient,
  partnerId: string,
  email: string
) {
  const user = await tx.user.findUnique({
    where: { email: normalizePartnerEmail(email) },
    select: { id: true },
  });

  if (!user) return;

  await tx.partnerProfile.update({
    where: { id: partnerId },
    data: { userId: user.id },
  });
}
