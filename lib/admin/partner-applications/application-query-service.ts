import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildReferralUrl } from "@/lib/partner-cookie";
import { getAudienceTypeLabel } from "@/lib/partner-utils";
import { normalizePartnerEmail } from "@/lib/partner-utils";
import { AdminPartnerApplicationServiceError } from "@/lib/admin/partner-applications/admin-partner-application-errors";
import { buildStructuredApplicationActivityWhere } from "@/lib/admin/partner-applications/admin-partner-application-audit-service";
import { detectApplicationIssues } from "@/lib/admin/partner-applications/admin-partner-application-issue-service";
import {
  maskIban,
  maskTaxNumber,
  redactApplicationRow,
} from "@/lib/admin/partner-applications/admin-partner-application-privacy";
import type { ApplicationListFilters } from "@/lib/admin/partner-applications/application-types";
import { DEFAULT_APPLICATION_PAGE_SIZE } from "@/lib/admin/partner-applications/application-types";

function buildWhere(filters: ApplicationListFilters): Prisma.PartnerApplicationWhereInput {
  const where: Prisma.PartnerApplicationWhereInput = {};

  if (filters.status) {
    where.status = filters.status as Prisma.EnumPartnerApplicationStatusFilter;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      if (!Number.isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    const or: Prisma.PartnerApplicationWhereInput[] = [
      { id: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
    or.push({
      profile: {
        userId: q,
      },
    });
    where.OR = or;
  }

  return where;
}

function orderBy(sort?: string): Prisma.PartnerApplicationOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "name_asc":
      return { fullName: "asc" };
    case "name_desc":
      return { fullName: "desc" };
    case "status_asc":
      return { status: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

function waitingDays(createdAt: Date, status: string): number | null {
  if (status !== "PENDING") return null;
  const ms = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

async function emailDuplicateCounts(emails: string[]) {
  if (!emails.length) return new Map<string, number>();
  const rows = await db.partnerApplication.groupBy({
    by: ["email"],
    where: { email: { in: emails } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.email.toLowerCase(), r._count._all]));
}

export async function getPartnerApplicationSummary() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const staleDate = new Date(sevenDaysAgo);

  const applications = await db.partnerApplication.findMany({
    select: { id: true, email: true, phone: true, status: true, createdAt: true },
  });

  const emails = [...new Set(applications.map((a) => a.email.toLowerCase()))];
  const partnerEmails = await db.partnerProfile.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const partnerEmailSet = new Set(partnerEmails.map((p) => p.email.toLowerCase()));

  const emailCounts = new Map<string, number>();
  for (const app of applications) {
    const key = app.email.toLowerCase();
    emailCounts.set(key, (emailCounts.get(key) ?? 0) + 1);
  }

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let last7Days = 0;
  let stalePending = 0;
  let matchingPartner = 0;
  let missingInfo = 0;
  let duplicateEmailSuspicion = 0;

  for (const app of applications) {
    const status = app.status as string;
    if (status === "PENDING") pending += 1;
    else if (status === "APPROVED") approved += 1;
    else if (status === "REJECTED") rejected += 1;

    if (app.createdAt >= sevenDaysAgo) last7Days += 1;
    if (status === "PENDING" && app.createdAt < staleDate) stalePending += 1;
    if (partnerEmailSet.has(app.email.toLowerCase())) matchingPartner += 1;
    if (!app.email?.trim() || !app.phone?.trim()) missingInfo += 1;
    if ((emailCounts.get(app.email.toLowerCase()) ?? 0) > 1) duplicateEmailSuspicion += 1;
  }

  return {
    total: applications.length,
    pending,
    approved,
    rejected,
    last7Days,
    stalePending,
    matchingPartner,
    missingInfo,
    duplicateEmailSuspicion,
  };
}

export async function listPartnerApplicationsAdmin(filters: ApplicationListFilters) {
  const where = buildWhere(filters);
  const page = filters.page;
  const pageSize = filters.pageSize || DEFAULT_APPLICATION_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    db.partnerApplication.count({ where }),
    db.partnerApplication.findMany({
      where,
      orderBy: orderBy(filters.sort),
      skip,
      take: pageSize,
      include: {
        profile: {
          select: { id: true, email: true, applicationId: true, referralCode: true, status: true },
        },
      },
    }),
  ]);

  const emails = rows.map((r) => r.email.toLowerCase());
  const [dupCounts, matchingProfiles] = await Promise.all([
    emailDuplicateCounts(emails),
    db.partnerProfile.findMany({
      where: { email: { in: rows.map((r) => normalizePartnerEmail(r.email)) } },
      select: { id: true, email: true, applicationId: true },
    }),
  ]);
  const profileByEmail = new Map(
    matchingProfiles.map((p) => [p.email.toLowerCase(), p])
  );

  const items = rows.map((app) => {
    const issues = detectApplicationIssues({
      application: app,
      linkedProfile: app.profile,
      matchingProfileByEmail: profileByEmail.get(app.email.toLowerCase()) ?? null,
      duplicateEmailCount: dupCounts.get(app.email.toLowerCase()) ?? 1,
    });

    return redactApplicationRow({
      id: app.id,
      fullName: app.fullName,
      email: app.email,
      phone: app.phone,
      audienceType: app.audienceType,
      audienceTypeLabel: getAudienceTypeLabel(app.audienceType),
      status: app.status,
      createdAt: app.createdAt.toISOString(),
      waitingDays: waitingDays(app.createdAt, app.status),
      linkedPartnerId: app.profile?.id ?? null,
      topIssue: issues[0]?.code ?? null,
      issueCount: issues.length,
    });
  });

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getPartnerApplicationDetail(applicationId: string) {
  const application = await db.partnerApplication.findUnique({
    where: { id: applicationId },
    include: {
        profile: {
          select: {
            id: true,
            applicationId: true,
            fullName: true,
            email: true,
            referralCode: true,
            status: true,
            commissionRate: true,
            userId: true,
            iban: true,
            taxNumber: true,
            bankName: true,
            accountHolderName: true,
            payoutMethod: true,
            createdAt: true,
          },
        },
    },
  });

  if (!application) {
    throw new AdminPartnerApplicationServiceError("Başvuru bulunamadı.", 404);
  }

  const normalizedEmail = normalizePartnerEmail(application.email);
  const [matchedUser, matchingProfile, duplicateEmailCount, history] = await Promise.all([
    db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, status: true },
    }),
    db.partnerProfile.findFirst({
      where: { email: normalizedEmail },
      select: { id: true, email: true, applicationId: true, status: true, referralCode: true },
    }),
    db.partnerApplication.count({ where: { email: application.email } }),
    listPartnerApplicationHistory(applicationId),
  ]);

  const issues = detectApplicationIssues({
    application,
    linkedProfile: application.profile,
    matchingProfileByEmail: matchingProfile,
    duplicateEmailCount,
    matchedUserId: matchedUser?.id ?? null,
  });

  const profile = application.profile;
  const maskedProfile = profile
    ? {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        referralCode: profile.referralCode,
        referralUrl: buildReferralUrl(profile.referralCode),
        status: profile.status,
        commissionRate: Number(profile.commissionRate),
        userId: profile.userId,
        payoutMethod: profile.payoutMethod,
        ibanMasked: maskIban(profile.iban),
        taxNumberMasked: maskTaxNumber(profile.taxNumber),
        bankName: profile.bankName ? "****" : null,
        accountHolderName: profile.accountHolderName,
        createdAt: profile.createdAt.toISOString(),
      }
      : matchingProfile
        ? {
            id: matchingProfile.id,
            email: matchingProfile.email,
            referralCode: matchingProfile.referralCode,
            referralUrl: buildReferralUrl(matchingProfile.referralCode),
            status: matchingProfile.status,
            applicationId: matchingProfile.applicationId,
          }
        : null;

  return redactApplicationRow({
    application: {
      id: application.id,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      socialUrl: application.socialUrl,
      audienceType: application.audienceType,
      audienceTypeLabel: getAudienceTypeLabel(application.audienceType),
      expectedReach: application.expectedReach,
      message: application.message,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      waitingDays: waitingDays(application.createdAt, application.status),
      adminEvaluationNote:
        application.status === "REJECTED" ? application.rejectionReason : null,
    },
    matchedUser: matchedUser
      ? { id: matchedUser.id, name: matchedUser.name, email: matchedUser.email, status: matchedUser.status }
      : null,
    linkedPartner: maskedProfile,
    issues,
    history,
  });
}

export async function listPartnerApplicationHistory(applicationId: string) {
  const rows = await db.activityLog.findMany({
    where: buildStructuredApplicationActivityWhere(applicationId),
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      message: true,
      createdAt: true,
      userId: true,
    },
  });

  return rows.map((row) =>
    redactApplicationRow({
      id: row.id,
      action: row.action,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
    })
  );
}
