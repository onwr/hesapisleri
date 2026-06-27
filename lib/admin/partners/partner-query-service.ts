import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { subscriptionToMonthlyMinor } from "@/lib/admin/admin-overview-metric-utils";
import { resolveMrrMonthlyMinor } from "@/lib/admin/plans/admin-plan-mrr-resolution";
import { AdminPartnerServiceError } from "@/lib/admin/partners/admin-partner-errors";
import {
  buildStructuredPartnerActivityWhere,
  matchesStructuredPartnerScope,
  parseMetadata,
  redactPartnerActivityRow,
} from "@/lib/admin/partners/admin-partner-activity-scope";
import { detectPartnerIssues } from "@/lib/admin/partners/admin-partner-issue-service";
import type { PartnerListFilters } from "@/lib/admin/partners/partner-types";
import { DEFAULT_PARTNER_PAGE_SIZE } from "@/lib/admin/partners/partner-types";
import { buildReferralUrl } from "@/lib/partner-cookie";
import {
  getBadgeTypeLabel,
  getConversionTypeLabel,
  getEarningStatusLabel,
} from "@/lib/partner-utils";

function buildWhere(filters: PartnerListFilters): Prisma.PartnerProfileWhereInput {
  const where: Prisma.PartnerProfileWhereInput = {};
  if (filters.status) {
    where.status = filters.status as Prisma.EnumPartnerProfileStatusFilter;
  }
  if (filters.badgeType) {
    where.badgeType = filters.badgeType as Prisma.EnumPartnerBadgeTypeFilter;
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { referralCode: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

function orderBy(sort?: string): Prisma.PartnerProfileOrderByWithRelationInput {
  switch (sort) {
    case "name_asc":
      return { fullName: "asc" };
    case "name_desc":
      return { fullName: "desc" };
    case "code_asc":
      return { referralCode: "asc" };
    case "created_asc":
      return { createdAt: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

async function partnerCompanyCounts(partnerIds: string[]) {
  const rows = await db.company.groupBy({
    by: ["referringPartnerId"],
    where: { referringPartnerId: { in: partnerIds } },
    _count: { _all: true },
  });
  return new Map(
    rows
      .filter((r) => r.referringPartnerId)
      .map((r) => [r.referringPartnerId!, r._count._all])
  );
}

async function partnerActiveSubCounts(partnerIds: string[]) {
  const companies = await db.company.findMany({
    where: { referringPartnerId: { in: partnerIds } },
    select: {
      referringPartnerId: true,
      subscription: { select: { status: true } },
    },
  });
  const map = new Map<string, number>();
  for (const c of companies) {
    if (!c.referringPartnerId) continue;
    const active =
      c.subscription?.status &&
      ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END"].includes(
        c.subscription.status
      );
    if (active) {
      map.set(c.referringPartnerId, (map.get(c.referringPartnerId) ?? 0) + 1);
    }
  }
  return map;
}

async function lastActivityByPartner(partnerIds: string[]) {
  const map = new Map<string, string>();
  for (const id of partnerIds) {
    const row = await db.activityLog.findFirst({
      where: buildStructuredPartnerActivityWhere(id),
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (row) map.set(id, row.createdAt.toISOString());
  }
  return map;
}

export async function getPartnerSummary() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const partners = await db.partnerProfile.findMany({
    select: { id: true, status: true, commissionRate: true, email: true, phone: true, iban: true, payoutMethod: true },
  });

  const companyCounts = await partnerCompanyCounts(partners.map((p) => p.id));
  const newThisMonth = await db.company.count({
    where: { referredAt: { gte: monthStart }, referringPartnerId: { not: null } },
  });

  let active = 0;
  let passiveSuspended = 0;
  let archived = 0;
  let withCompanies = 0;
  let withoutCompanies = 0;
  let missingCommission = 0;
  let missingPayment = 0;

  for (const p of partners) {
    const status = p.status as string;
    if (status === "ACTIVE") active += 1;
    else if (status === "ARCHIVED") archived += 1;
    else if (status === "PASSIVE" || status === "SUSPENDED") passiveSuspended += 1;

    const cc = companyCounts.get(p.id) ?? 0;
    if (cc > 0) withCompanies += 1;
    else withoutCompanies += 1;

    if (Number(p.commissionRate) <= 0) missingCommission += 1;
    if (!p.iban && !p.payoutMethod) missingPayment += 1;
  }

  return {
    total: partners.length,
    active,
    passiveSuspended,
    archived,
    withCompanies,
    withoutCompanies,
    newCompaniesThisMonth: newThisMonth,
    missingCommissionConfig: missingCommission,
    missingPaymentProfile: missingPayment,
  };
}

export async function listPartners(filters: PartnerListFilters) {
  const pageSize = filters.pageSize || DEFAULT_PARTNER_PAGE_SIZE;
  const where = buildWhere(filters);

  let partnerIdsFilter: string[] | undefined;
  if (filters.hasCompanies === "true") {
    const rows = await db.company.groupBy({
      by: ["referringPartnerId"],
      where: { referringPartnerId: { not: null } },
    });
    partnerIdsFilter = rows.map((r) => r.referringPartnerId!).filter(Boolean);
    if (!partnerIdsFilter.length) {
      return { items: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } };
    }
    where.id = { in: partnerIdsFilter };
  } else if (filters.hasCompanies === "false") {
    const withCo = await db.company.groupBy({
      by: ["referringPartnerId"],
      where: { referringPartnerId: { not: null } },
    });
    const exclude = new Set(withCo.map((r) => r.referringPartnerId!).filter(Boolean));
    where.id = { notIn: [...exclude] };
  }

  const [total, rows] = await Promise.all([
    db.partnerProfile.count({ where }),
    db.partnerProfile.findMany({
      where,
      orderBy: orderBy(filters.sort),
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const ids = rows.map((r) => r.id);
  const [companyCounts, activeSubCounts, lastActivity] = await Promise.all([
    partnerCompanyCounts(ids),
    partnerActiveSubCounts(ids),
    lastActivityByPartner(ids),
  ]);

  const items = rows.map((p) => {
    const companyCount = companyCounts.get(p.id) ?? 0;
    const issues = detectPartnerIssues({
      partner: p,
      companyCount,
      activeCompanyCount: activeSubCounts.get(p.id) ?? 0,
    });
    return {
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      referralCode: p.referralCode,
      status: p.status,
      badgeType: p.badgeType,
      badgeLabel: p.badgeLabel ?? getBadgeTypeLabel(p.badgeType),
      commissionRate: Number(p.commissionRate),
      commissionSummary: `%${Number(p.commissionRate)}`,
      companyCount,
      activeSubscriptionCompanies: activeSubCounts.get(p.id) ?? 0,
      lastActivityAt: lastActivity.get(p.id) ?? null,
      issues,
      primaryIssue: issues[0] ?? null,
    };
  });

  return {
    items,
    pagination: {
      page: filters.page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getPartnerDetail(partnerId: string) {
  const partner = await db.partnerProfile.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AdminPartnerServiceError("Partner bulunamadı.", 404);

  const companyCount = await db.company.count({ where: { referringPartnerId: partnerId } });
  const activeCompanyCount = await partnerActiveSubCounts([partnerId]).then(
    (m) => m.get(partnerId) ?? 0
  );

  const orphanEarnings = await db.partnerEarning.count({
    where: { partnerId, conversionId: null, status: { not: "CANCELLED" } },
  });

  const earningCurrencies = await db.partnerEarning.groupBy({
    by: ["currency"],
    where: { partnerId, status: { not: "CANCELLED" } },
    _count: { _all: true },
  });

  const issues = detectPartnerIssues({
    partner,
    companyCount,
    activeCompanyCount,
    orphanEarningCount: orphanEarnings,
    currencyMismatchCount: earningCurrencies.length > 1 ? earningCurrencies.length : 0,
  });

  return {
    partner: {
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
      payoutMethod: partner.payoutMethod,
      iban: partner.iban,
      bankName: partner.bankName,
      accountHolderName: partner.accountHolderName,
      taxNumber: partner.taxNumber,
      notes: partner.notes,
      createdAt: partner.createdAt.toISOString(),
      updatedAt: partner.updatedAt.toISOString(),
    },
    stats: {
      companyCount,
      activeSubscriptionCompanies: activeCompanyCount,
    },
    issues,
  };
}

export async function listPartnerCompanies(
  partnerId: string,
  filters: { page?: number; pageSize?: number; q?: string }
) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && [25, 50, 100].includes(filters.pageSize) ? filters.pageSize : 25;

  const where: Prisma.CompanyWhereInput = { referringPartnerId: partnerId };
  if (filters.q?.trim()) {
    where.name = { contains: filters.q.trim(), mode: "insensitive" };
  }

  const [total, companies] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: { referredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        subscription: {
          include: {
            plan: { select: { id: true, name: true, code: true } },
            lockedPlanPrice: {
              select: { currency: true, salePriceMinor: true, billingInterval: true },
            },
          },
        },
      },
    }),
  ]);

  const items = await Promise.all(
    companies.map(async (c) => {
      const sub = c.subscription;
      const lastPayment = await db.membershipPayment.findFirst({
        where: { companyId: c.id, status: "PAID" },
        orderBy: { paidAt: "desc" },
        select: { paidAt: true, amountMinor: true, currency: true },
      });

      let mrrMonthlyMinor: number | null = null;
      let mrrCurrency: string | null = null;
      if (sub) {
        const lockedPlanPrice = sub.lockedPlanPrice
          ? {
              currency: sub.lockedPlanPrice.currency,
              billingInterval: sub.lockedPlanPrice.billingInterval,
              monthlyEquivalentMinor: subscriptionToMonthlyMinor({
                billingInterval: sub.lockedPlanPrice.billingInterval,
                lockedPriceMinor: sub.lockedPlanPrice.salePriceMinor,
              }),
            }
          : null;
        const mrr = resolveMrrMonthlyMinor({
          subscriptionId: sub.id,
          status: sub.status,
          billingInterval: sub.billingInterval,
          lockedPriceMinor: sub.lockedPriceMinor,
          lockedListPriceMinor: sub.lockedListPriceMinor,
          lockedPlanPriceId: sub.lockedPlanPriceId,
          lockedPlanPrice,
          paymentSnapshot: lastPayment
            ? {
                subscriptionId: sub.id,
                amountMinor: lastPayment.amountMinor,
                currency: lastPayment.currency,
                billingPeriodSnapshot: null,
                periodMonthsSnapshot: null,
                monthlyEquivalentMinor: null,
              }
            : null,
          resolver: null,
        });
        mrrMonthlyMinor = mrr.monthlyMinor;
        mrrCurrency = mrr.currency;
      }

      return {
        companyId: c.id,
        companyName: c.name,
        relationSource: c.referralCode ? "REFERRAL_CODE" : "ATTRIBUTION",
        referredAt: c.referredAt?.toISOString() ?? null,
        referralCode: c.referralCode,
        subscriptionStatus: sub?.status ?? null,
        plan: sub?.plan ? { id: sub.plan.id, name: sub.plan.name, code: sub.plan.code } : null,
        billingInterval: sub?.billingInterval ?? null,
        mrrMonthlyMinor,
        mrrCurrency,
        lastPayment: lastPayment
          ? {
              paidAt: lastPayment.paidAt?.toISOString() ?? null,
              amountMinor: lastPayment.amountMinor,
              currency: lastPayment.currency,
            }
          : null,
      };
    })
  );

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listPartnerCommissions(
  partnerId: string,
  filters: { page?: number; pageSize?: number }
) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && [25, 50, 100].includes(filters.pageSize) ? filters.pageSize : 25;

  const [conversions, earnings, conversionTotal, earningTotal] = await Promise.all([
    db.partnerConversion.findMany({
      where: { partnerId },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { company: { select: { id: true, name: true } } },
    }),
    db.partnerEarning.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.partnerConversion.count({ where: { partnerId } }),
    db.partnerEarning.count({ where: { partnerId } }),
  ]);

  const totalsByCurrency: Record<
    string,
    { pending: number; approved: number; paid: number; payable: number }
  > = {};

  for (const e of earnings) {
    const cur = e.currency;
    if (!totalsByCurrency[cur]) {
      totalsByCurrency[cur] = { pending: 0, approved: 0, paid: 0, payable: 0 };
    }
    const amt = Number(e.amount);
    if (e.status === "PENDING") totalsByCurrency[cur].pending += amt;
    else if (e.status === "APPROVED") totalsByCurrency[cur].approved += amt;
    else if (e.status === "PAID") totalsByCurrency[cur].paid += amt;
    else if (e.status === "PAYABLE") totalsByCurrency[cur].payable += amt;
  }

  return {
    conversions: conversions.map((c) => ({
      id: c.id,
      type: c.type,
      typeLabel: getConversionTypeLabel(c.type),
      amount: Number(c.amount),
      commissionRate: Number(c.commissionRate),
      commissionAmount: Number(c.commissionAmount),
      status: c.status,
      source: c.source,
      company: c.company ? { id: c.company.id, name: c.company.name } : null,
      occurredAt: c.occurredAt.toISOString(),
    })),
    earnings: earnings.slice(0, pageSize).map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      currency: e.currency,
      status: e.status,
      statusLabel: getEarningStatusLabel(e.status),
      description: e.description,
      conversionId: e.conversionId,
      membershipPaymentId: e.membershipPaymentId,
      createdAt: e.createdAt.toISOString(),
      paidAt: e.paidAt?.toISOString() ?? null,
    })),
    totalsByCurrency,
    pagination: {
      page,
      pageSize,
      total: conversionTotal + earningTotal,
      conversionTotal,
      earningTotal,
    },
  };
}

export async function listPartnerHistory(partnerId: string, page = 1, pageSize = 25) {
  const where = buildStructuredPartnerActivityWhere(partnerId);
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      actorName: r.user?.name ?? r.user?.email ?? "Sistem",
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listPartnerActivity(partnerId: string, page = 1, pageSize = 25) {
  const where = buildStructuredPartnerActivityWhere(partnerId);
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const items = rows
    .filter((r) => matchesStructuredPartnerScope(r, partnerId))
    .map((r) =>
      redactPartnerActivityRow({
        id: r.id,
        action: r.action,
        message: r.message,
        metadata: parseMetadata(r.metadata),
        createdAt: r.createdAt.toISOString(),
        actor: r.user ? { name: r.user.name, email: r.user.email } : null,
      })
    );

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
