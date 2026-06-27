import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts/admin-partner-payout-errors";
import { buildStructuredPayoutActivityWhere } from "@/lib/admin/partner-payouts/admin-partner-payout-audit-service";
import { redactPayoutActivityRow } from "@/lib/admin/partner-payouts/admin-partner-payout-activity-scope";
import { detectPayoutIssues } from "@/lib/admin/partner-payouts/admin-partner-payout-issue-service";
import {
  maskIban,
  maskPaymentReference,
  redactPayoutRow,
} from "@/lib/admin/partner-payouts/admin-partner-payout-privacy";
import {
  addToCurrencyMap,
  emptyCurrencyMap,
  DEFAULT_PAYOUT_PAGE_SIZE,
  type CurrencyAmountMap,
  type EligibleEarningFilters,
  type PayoutListFilters,
} from "@/lib/admin/partner-payouts/payout-types";

function parseDateStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseDateEnd(value?: string): Date | undefined {
  const d = parseDateStart(value);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildWhere(filters: PayoutListFilters): Prisma.PartnerPayoutWhereInput {
  const where: Prisma.PartnerPayoutWhereInput = {};

  if (filters.status) {
    where.status = filters.status as Prisma.EnumPartnerPayoutStatusFilter;
  }
  if (filters.currency) {
    where.currency = filters.currency;
  }
  if (filters.periodFrom || filters.periodTo) {
    where.createdAt = {};
    const from = parseDateStart(filters.periodFrom);
    const to = parseDateEnd(filters.periodTo);
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  if (filters.paidFrom || filters.paidTo) {
    where.paidAt = {};
    const from = parseDateStart(filters.paidFrom);
    const to = parseDateEnd(filters.paidTo);
    if (from) where.paidAt.gte = from;
    if (to) where.paidAt.lte = to;
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      {
        partner: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { referralCode: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  return where;
}

function orderBy(sort?: string): Prisma.PartnerPayoutOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "amount_desc":
      return { amount: "desc" };
    case "amount_asc":
      return { amount: "asc" };
    case "paid_desc":
      return { paidAt: "desc" };
    case "status_asc":
      return { status: "asc" };
    default:
      return { createdAt: "desc" };
  }
}

function serializePaymentProfile(partner: {
  iban: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  payoutMethod: string | null;
}) {
  return {
    payoutMethod: partner.payoutMethod,
    ibanMasked: maskIban(partner.iban),
    bankName: partner.bankName,
    accountHolderName: partner.accountHolderName,
  };
}

function topIssue(issues: ReturnType<typeof detectPayoutIssues>) {
  const err = issues.find((i) => i.severity === "error");
  if (err) return err;
  const warn = issues.find((i) => i.severity === "warning");
  return warn ?? null;
}

export async function getPartnerPayoutSummary() {
  const payouts = await db.partnerPayout.findMany({
    include: {
      partner: {
        select: { id: true, status: true, iban: true, accountHolderName: true, payoutMethod: true },
      },
      earnings: {
        select: { id: true, amount: true, currency: true, status: true, partnerId: true, payoutId: true },
      },
    },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totals = emptyCurrencyMap();
  const draft = emptyCurrencyMap();
  const pending = emptyCurrencyMap();
  const paid = emptyCurrencyMap();
  const cancelled = emptyCurrencyMap();
  const paidThisMonth = emptyCurrencyMap();
  const pendingTotal = emptyCurrencyMap();

  let paymentProfileMissing = 0;
  let totalMismatch = 0;

  for (const payout of payouts) {
    const amount = Number(payout.amount);
    const cur = payout.currency || "TRY";
    addToCurrencyMap(totals, cur, amount);

    if (payout.status === "DRAFT") addToCurrencyMap(draft, cur, amount);
    if (payout.status === "PENDING") addToCurrencyMap(pending, cur, amount);
    if (payout.status === "PAID") addToCurrencyMap(paid, cur, amount);
    if (payout.status === "CANCELLED") addToCurrencyMap(cancelled, cur, amount);
    if (payout.status === "DRAFT" || payout.status === "PENDING") {
      addToCurrencyMap(pendingTotal, cur, amount);
    }
    if (payout.status === "PAID" && payout.paidAt && payout.paidAt >= monthStart) {
      addToCurrencyMap(paidThisMonth, cur, amount);
    }

    const issues = detectPayoutIssues({
      payout,
      partner: payout.partner,
      earnings: payout.earnings,
    });
    if (issues.some((i) => i.code === "PAYMENT_PROFILE_MISSING")) paymentProfileMissing += 1;
    if (issues.some((i) => i.code === "TOTAL_MISMATCH")) totalMismatch += 1;
  }

  return {
    total: totals,
    draft,
    pending,
    paid,
    cancelled,
    paidThisMonth,
    pendingTotal,
    paymentProfileMissing,
    totalMismatch,
    count: payouts.length,
  };
}

export async function listPartnerPayoutsAdmin(filters: PayoutListFilters) {
  const where = buildWhere(filters);
  const page = filters.page;
  const pageSize = filters.pageSize;

  const [total, rows] = await Promise.all([
    db.partnerPayout.count({ where }),
    db.partnerPayout.findMany({
      where,
      orderBy: orderBy(filters.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        partner: {
          select: { id: true, fullName: true, email: true, referralCode: true, status: true, iban: true, accountHolderName: true, payoutMethod: true },
        },
        paidByUser: { select: { id: true, name: true, email: true } },
        earnings: {
          select: { id: true, amount: true, currency: true, status: true, partnerId: true, payoutId: true },
        },
      },
    }),
  ]);

  let items = rows.map((payout) => {
    const issues = detectPayoutIssues({
      payout,
      partner: payout.partner,
      earnings: payout.earnings,
    });
    const top = topIssue(issues);
    return redactPayoutRow({
      id: payout.id,
      partnerId: payout.partnerId,
      partnerName: payout.partner.fullName,
      partnerEmail: payout.partner.email,
      referralCode: payout.partner.referralCode,
      partnerStatus: payout.partner.status,
      amount: Number(payout.amount),
      currency: payout.currency,
      status: payout.status,
      paymentMethod: payout.paymentMethod,
      paymentReferenceMasked: maskPaymentReference(payout.paymentReference),
      paidBy: payout.paidByUser
        ? { id: payout.paidByUser.id, name: payout.paidByUser.name, email: payout.paidByUser.email }
        : null,
      earningCount: payout.earnings.length,
      paidAt: payout.paidAt?.toISOString() ?? null,
      createdAt: payout.createdAt.toISOString(),
      topIssue: top ? { code: top.code, message: top.message } : null,
      hasIssue: issues.some((i) => i.severity === "error" || i.severity === "warning"),
    });
  });

  if (filters.hasIssue === true) {
    items = items.filter((i) => i.hasIssue);
  } else if (filters.hasIssue === false) {
    items = items.filter((i) => !i.hasIssue);
  }

  return {
    items,
    pagination: {
      page,
      pageSize,
      total: filters.hasIssue != null ? items.length : total,
      totalPages: Math.max(1, Math.ceil((filters.hasIssue != null ? items.length : total) / pageSize)),
    },
  };
}

export async function getPartnerPayoutDetail(payoutId: string) {
  const payout = await db.partnerPayout.findUnique({
    where: { id: payoutId },
    include: {
      partner: {
        select: {
          id: true,
          fullName: true,
          email: true,
          referralCode: true,
          status: true,
          iban: true,
          bankName: true,
          accountHolderName: true,
          payoutMethod: true,
        },
      },
      paidByUser: { select: { id: true, name: true, email: true } },
      earnings: {
        select: { id: true, amount: true, currency: true, status: true, partnerId: true, payoutId: true },
      },
    },
  });

  if (!payout) {
    throw new AdminPartnerPayoutServiceError("Ödeme bulunamadı.", 404);
  }

  const issues = detectPayoutIssues({
    payout,
    partner: payout.partner,
    earnings: payout.earnings,
  });

  return redactPayoutRow({
    payout: {
      id: payout.id,
      partnerId: payout.partnerId,
      status: payout.status,
      currency: payout.currency,
      amount: Number(payout.amount),
      earningCount: payout.earnings.length,
      paymentMethod: payout.paymentMethod,
      note: payout.note,
      paymentReferenceMasked: maskPaymentReference(payout.paymentReference),
      paidAt: payout.paidAt?.toISOString() ?? null,
      paidBy: payout.paidByUser
        ? { id: payout.paidByUser.id, name: payout.paidByUser.name, email: payout.paidByUser.email }
        : null,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
    },
    partner: {
      id: payout.partner.id,
      fullName: payout.partner.fullName,
      email: payout.partner.email,
      referralCode: payout.partner.referralCode,
      status: payout.partner.status,
      paymentProfile: serializePaymentProfile(payout.partner),
    },
    issues,
  });
}

export async function listPayoutEarnings(payoutId: string) {
  const payout = await db.partnerPayout.findUnique({
    where: { id: payoutId },
    select: { id: true },
  });
  if (!payout) throw new AdminPartnerPayoutServiceError("Ödeme bulunamadı.", 404);

  const earnings = await db.partnerEarning.findMany({
    where: { payoutId },
    orderBy: { createdAt: "desc" },
    include: {
      conversion: {
        select: {
          id: true,
          type: true,
          commissionRate: true,
          company: { select: { id: true, name: true } },
        },
      },
      membershipPayment: {
        select: {
          id: true,
          amount: true,
          currency: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });

  return earnings.map((e) =>
    redactPayoutRow({
      id: e.id,
      companyName:
        e.conversion?.company?.name ?? e.membershipPayment?.company?.name ?? null,
      membershipPaymentId: e.membershipPaymentId,
      conversionType: e.conversion?.type ?? null,
      commissionRate: e.conversion ? Number(e.conversion.commissionRate) : null,
      amount: Number(e.amount),
      currency: e.currency,
      status: e.status,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
    })
  );
}

export async function listPayoutHistory(payoutId: string, page = 1, pageSize = DEFAULT_PAYOUT_PAGE_SIZE) {
  const where = buildStructuredPayoutActivityWhere(payoutId);
  const skip = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return {
    items: rows.map((row) =>
      redactPayoutActivityRow({
        id: row.id,
        action: row.action,
        message: row.message,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? { id: row.user.id, name: row.user.name, email: row.user.email }
          : null,
        metadata: row.metadata,
      })
    ),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listPayoutActivity(payoutId: string, page = 1, pageSize = DEFAULT_PAYOUT_PAGE_SIZE) {
  return listPayoutHistory(payoutId, page, pageSize);
}

export async function listEligiblePayoutEarnings(filters: EligibleEarningFilters) {
  const where: Prisma.PartnerEarningWhereInput = {
    partnerId: filters.partnerId,
    payoutId: null,
    status: { in: ["APPROVED", "PAYABLE"] },
  };

  if (filters.currency) {
    where.currency = filters.currency;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    const from = parseDateStart(filters.dateFrom);
    const to = parseDateEnd(filters.dateTo);
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  if (filters.amountMin != null || filters.amountMax != null) {
    where.amount = {};
    if (filters.amountMin != null) where.amount.gte = filters.amountMin;
    if (filters.amountMax != null) where.amount.lte = filters.amountMax;
  }

  if (filters.company?.trim()) {
    const q = filters.company.trim();
    where.OR = [
      { conversion: { company: { name: { contains: q, mode: "insensitive" } } } },
      { membershipPayment: { company: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const earnings = await db.partnerEarning.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      conversion: {
        select: {
          type: true,
          commissionRate: true,
          company: { select: { id: true, name: true } },
        },
      },
      membershipPayment: {
        select: {
          id: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });

  return earnings.map((e) =>
    redactPayoutRow({
      id: e.id,
      partnerId: e.partnerId,
      amount: Number(e.amount),
      currency: e.currency,
      status: e.status,
      description: e.description,
      companyName:
        e.conversion?.company?.name ?? e.membershipPayment?.company?.name ?? null,
      conversionType: e.conversion?.type ?? null,
      commissionRate: e.conversion ? Number(e.conversion.commissionRate) : null,
      createdAt: e.createdAt.toISOString(),
    })
  );
}
