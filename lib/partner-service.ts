import type {
  PartnerBadgeType,
  PartnerProfileStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { buildReferralUrl } from "@/lib/partner-cookie";
import {
  ensurePartnerSettings,
  resolvePartnerFromAttribution,
} from "@/lib/partner-conversion-service";
import {
  calculateConversionRate,
  generateReferralCode,
  getBadgeTypeLabel,
  getConversionTypeLabel,
  getEarningStatusLabel,
  hashPartnerIp,
  normalizePartnerEmail,
  PARTNER_MONTHLY_SIGNUP_GOAL,
  partnerApplicationSchema,
  sanitizeReferralCode,
} from "@/lib/partner-utils";

export class PartnerServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerServiceError";
    this.status = status;
  }
}

export async function resolvePartnerForUser(userId: string, email: string) {
  return db.partnerProfile.findFirst({
    where: {
      status: { in: ["ACTIVE", "PASSIVE", "SUSPENDED"] },
      OR: [{ userId }, { email: normalizePartnerEmail(email) }],
    },
  });
}

export type PublicReferralSignupInfo = {
  referralCode: string;
  partnerName: string | null;
};

export async function resolvePublicReferralSignupInfo(
  code: string
): Promise<PublicReferralSignupInfo | null> {
  const referralCode = sanitizeReferralCode(code);
  if (!referralCode) return null;

  const partner = await db.partnerProfile.findFirst({
    where: {
      referralCode,
      status: "ACTIVE",
    },
    select: {
      fullName: true,
      referralCode: true,
    },
  });

  return {
    referralCode: partner?.referralCode ?? referralCode,
    partnerName: partner?.fullName ?? null,
  };
}

function serializePartner(partner: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  referralCode: string;
  commissionRate: Prisma.Decimal;
  status: PartnerProfileStatus;
  badgeType: PartnerBadgeType;
  badgeLabel: string | null;
  iban: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  taxNumber?: string | null;
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
    badgeLabel: partner.badgeLabel ?? getBadgeTypeLabel(partner.badgeType),
    payoutInfo: {
      iban: partner.iban,
      bankName: partner.bankName,
      accountHolderName: partner.accountHolderName,
      taxNumber: partner.taxNumber ?? null,
    },
  };
}

export async function submitPartnerApplication(
  input: z.infer<typeof partnerApplicationSchema>
) {
  const settings = await ensurePartnerSettings();

  if (!settings.isApplicationOpen) {
    throw new PartnerServiceError("Başvurular şu anda kapalı.", 403);
  }

  const email = normalizePartnerEmail(input.email);

  const pending = await db.partnerApplication.findFirst({
    where: { email, status: "PENDING" },
  });

  if (pending) {
    throw new PartnerServiceError(
      "Bu e-posta ile bekleyen bir başvurunuz zaten var.",
      409
    );
  }

  const existingPartner = await db.partnerProfile.findFirst({
    where: { email },
  });

  if (existingPartner) {
    throw new PartnerServiceError("Bu e-posta ile kayıtlı bir partner zaten var.", 409);
  }

  return db.partnerApplication.create({
    data: {
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      socialUrl: input.socialUrl?.trim() || null,
      audienceType: input.audienceType,
      expectedReach: input.expectedReach?.trim() || null,
      message: input.message?.trim() || null,
    },
  });
}

export async function recordReferralClick(input: {
  referralCode: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}) {
  const partner = await resolvePartnerFromAttribution({
    referralCode: input.referralCode,
  });

  if (!partner) {
    return null;
  }

  const ipHash = input.ip ? hashPartnerIp(input.ip) : null;

  return db.partnerReferralClick.create({
    data: {
      partnerId: partner.id,
      referralCode: partner.referralCode,
      ipHash,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
      referrer: input.referrer?.slice(0, 500) ?? null,
      landingUrl: input.landingUrl?.slice(0, 500) ?? null,
      utmSource: input.utmSource ?? null,
      utmCampaign: input.utmCampaign ?? null,
    },
  });
}

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function getPartnerProfile(partnerId: string) {
  const partner = await db.partnerProfile.findUnique({
    where: { id: partnerId },
  });

  if (!partner) {
    throw new PartnerServiceError("Partner bulunamadı.", 404);
  }

  return serializePartner(partner);
}

export async function getPartnerDashboardStats(partnerId: string) {
  const partner = await db.partnerProfile.findUnique({
    where: { id: partnerId },
  });

  if (!partner) {
    throw new PartnerServiceError("Partner bulunamadı.", 404);
  }

  const settings = await ensurePartnerSettings();
  const start = monthStart();

  const [
    totalClicks,
    monthClicks,
    uniqueIpGroups,
    clicksWithoutIp,
    signups,
    monthSignups,
    paidCompanies,
    monthPaidConversions,
    pendingEarnings,
    approvedEarnings,
    paidEarnings,
    payableEarnings,
    monthEarnings,
    monthConversionCommission,
  ] = await Promise.all([
    db.partnerReferralClick.count({ where: { partnerId } }),
    db.partnerReferralClick.count({
      where: { partnerId, clickedAt: { gte: start } },
    }),
    db.partnerReferralClick.groupBy({
      by: ["ipHash"],
      where: { partnerId, ipHash: { not: null } },
    }),
    db.partnerReferralClick.count({
      where: { partnerId, ipHash: null },
    }),
    db.partnerConversion.count({
      where: { partnerId, type: "SIGNUP", status: { not: "CANCELLED" } },
    }),
    db.partnerConversion.count({
      where: {
        partnerId,
        type: "SIGNUP",
        status: { not: "CANCELLED" },
        occurredAt: { gte: start },
      },
    }),
    db.partnerConversion.count({
      where: {
        partnerId,
        type: { in: ["PAID_MEMBERSHIP", "RENEWAL"] },
        status: { not: "CANCELLED" },
      },
    }),
    db.partnerConversion.count({
      where: {
        partnerId,
        type: { in: ["PAID_MEMBERSHIP", "RENEWAL"] },
        status: { not: "CANCELLED" },
        occurredAt: { gte: start },
      },
    }),
    db.partnerEarning.aggregate({
      where: { partnerId, status: "PENDING" },
      _sum: { amount: true },
    }),
    db.partnerEarning.aggregate({
      where: { partnerId, status: "APPROVED" },
      _sum: { amount: true },
    }),
    db.partnerEarning.aggregate({
      where: { partnerId, status: "PAID" },
      _sum: { amount: true },
    }),
    db.partnerEarning.aggregate({
      where: {
        partnerId,
        status: { in: ["APPROVED", "PAYABLE"] },
      },
      _sum: { amount: true },
    }),
    db.partnerEarning.aggregate({
      where: {
        partnerId,
        createdAt: { gte: start },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
    db.partnerConversion.aggregate({
      where: {
        partnerId,
        occurredAt: { gte: start },
        status: { not: "CANCELLED" },
        type: { in: ["PAID_MEMBERSHIP", "RENEWAL"] },
      },
      _sum: { commissionAmount: true },
    }),
  ]);

  const uniqueClicks = uniqueIpGroups.length + clicksWithoutIp;

  const pendingTotal = Number(pendingEarnings._sum.amount ?? 0);
  const approvedTotal = Number(approvedEarnings._sum.amount ?? 0);
  const paidTotal = Number(paidEarnings._sum.amount ?? 0);
  const payableTotal = Number(payableEarnings._sum.amount ?? 0);
  const monthEarningsTotal = Number(monthEarnings._sum.amount ?? 0);
  const monthCommissionTotal = Number(
    monthConversionCommission._sum.commissionAmount ?? 0
  );
  const totalEarnings = pendingTotal + approvedTotal + paidTotal;
  const minPayout = Number(settings.minimumPayoutAmount);
  const remainingToMin = Math.max(0, minPayout - payableTotal);
  const estimatedMonthlyEarnings =
    monthEarningsTotal > 0 ? monthEarningsTotal : monthCommissionTotal;
  const signupGoalProgress = Math.min(
    100,
    Math.round((monthSignups / PARTNER_MONTHLY_SIGNUP_GOAL) * 100)
  );

  return {
    partner: serializePartner(partner),
    metrics: {
      totalClicks,
      uniqueClicks,
      monthClicks,
      signups,
      monthSignups,
      paidCompanies,
      monthPaidConversions,
      conversionRate: calculateConversionRate(totalClicks, signups),
      pendingEarnings: pendingTotal,
      approvedEarnings: approvedTotal,
      paidTotal,
      totalEarnings,
      payableTotal,
      minimumPayoutAmount: minPayout,
      remainingToMinPayout: remainingToMin,
      canRequestPayout: payableTotal >= minPayout,
    },
    motivation: {
      monthClicksText: `Bu ay ${monthClicks} tıklama · ${monthSignups} kayıt · ${monthPaidConversions} dönüşüm`,
      payoutText:
        remainingToMin > 0
          ? `İlk ödemenize ₺${remainingToMin.toLocaleString("tr-TR")} kaldı`
          : "Ödeme talebi için yeterli bakiyeniz var",
      signupGoalProgress,
      signupGoalTarget: PARTNER_MONTHLY_SIGNUP_GOAL,
      estimatedMonthlyEarnings,
      partnerLevel: getBadgeTypeLabel(partner.badgeType),
    },
  };
}

export async function listPartnerClicks(partnerId: string, limit = 50) {
  const clicks = await db.partnerReferralClick.findMany({
    where: { partnerId },
    orderBy: { clickedAt: "desc" },
    take: limit,
  });

  return clicks.map((click) => ({
    id: click.id,
    referralCode: click.referralCode,
    clickedAt: click.clickedAt.toISOString(),
    converted: Boolean(click.convertedCompanyId),
    convertedAt: click.convertedAt?.toISOString() ?? null,
  }));
}

export async function listPartnerConversions(partnerId: string, limit = 50) {
  const conversions = await db.partnerConversion.findMany({
    where: { partnerId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { company: { select: { name: true } } },
  });

  return conversions.map((conversion) => ({
    id: conversion.id,
    type: conversion.type,
    typeLabel: getConversionTypeLabel(conversion.type),
    amount: Number(conversion.amount),
    commissionRate: Number(conversion.commissionRate),
    commissionAmount: Number(conversion.commissionAmount),
    status: conversion.status,
    companyName: conversion.company?.name ?? null,
    occurredAt: conversion.occurredAt.toISOString(),
  }));
}

export async function listPartnerEarnings(partnerId: string, limit = 50) {
  const earnings = await db.partnerEarning.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return earnings.map((earning) => ({
    id: earning.id,
    amount: Number(earning.amount),
    currency: earning.currency,
    status: earning.status,
    statusLabel: getEarningStatusLabel(earning.status),
    description: earning.description,
    createdAt: earning.createdAt.toISOString(),
    paidAt: earning.paidAt?.toISOString() ?? null,
  }));
}

export async function listPartnerPayouts(partnerId: string, limit = 50) {
  const payouts = await db.partnerPayout.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return payouts.map((payout) => ({
    id: payout.id,
    amount: Number(payout.amount),
    currency: payout.currency,
    status: payout.status,
    paymentMethod: payout.paymentMethod,
    paidAt: payout.paidAt?.toISOString() ?? null,
    note: payout.note,
    createdAt: payout.createdAt.toISOString(),
  }));
}

export async function listAdminPartners() {
  const partners = await db.partnerProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const enriched = await Promise.all(
    partners.map(async (partner) => {
      const [clicks, signups, paidEarnings] = await Promise.all([
        db.partnerReferralClick.count({ where: { partnerId: partner.id } }),
        db.partnerConversion.count({
          where: { partnerId: partner.id, type: "SIGNUP" },
        }),
        db.partnerEarning.aggregate({
          where: { partnerId: partner.id, status: "PAID" },
          _sum: { amount: true },
        }),
      ]);

      const earningsSum = await db.partnerEarning.aggregate({
        where: {
          partnerId: partner.id,
          status: { in: ["PENDING", "APPROVED", "PAYABLE"] },
        },
        _sum: { amount: true },
      });

      return {
        ...serializePartner(partner),
        clicks,
        signups,
        earnings: Number(earningsSum._sum.amount ?? 0),
        paidTotal: Number(paidEarnings._sum.amount ?? 0),
      };
    })
  );

  return enriched;
}

export async function updatePartnerProfileAdmin(
  partnerId: string,
  input: {
    commissionRate?: number;
    badgeType?: PartnerBadgeType;
    badgeLabel?: string | null;
    status?: PartnerProfileStatus;
    notes?: string | null;
  }
) {
  const partner = await db.partnerProfile.update({
    where: { id: partnerId },
    data: {
      commissionRate: input.commissionRate,
      badgeType: input.badgeType,
      badgeLabel: input.badgeLabel,
      status: input.status,
      notes: input.notes,
    },
  });

  return serializePartner(partner);
}

export async function getAdminPartnerDetail(partnerId: string) {
  const partner = await db.partnerProfile.findUnique({
    where: { id: partnerId },
  });

  if (!partner) {
    throw new PartnerServiceError("Partner bulunamadı.", 404);
  }

  const [clicks, conversions, earnings, payouts] = await Promise.all([
    listPartnerClicks(partnerId, 100),
    listPartnerConversions(partnerId, 100),
    listPartnerEarnings(partnerId, 100),
    listPartnerPayouts(partnerId, 100),
  ]);

  return {
    partner: {
      ...serializePartner(partner),
      notes: partner.notes,
      taxNumber: partner.taxNumber,
      createdAt: partner.createdAt.toISOString(),
    },
    clicks,
    conversions,
    earnings,
    payouts,
  };
}


export async function updatePartnerProfileSelf(
  partnerId: string,
  input: {
    phone?: string;
    iban?: string;
    bankName?: string;
    accountHolderName?: string;
    taxNumber?: string;
  }
) {
  const partner = await db.partnerProfile.update({
    where: { id: partnerId },
    data: {
      phone: input.phone,
      iban: input.iban,
      bankName: input.bankName,
      accountHolderName: input.accountHolderName,
      taxNumber: input.taxNumber,
    },
  });

  return serializePartner(partner);
}
