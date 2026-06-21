import type {
  MembershipPaymentMethod,
  MembershipPeriod,
  MembershipPaymentStatus,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  calculateMembershipAmount,
  calculateMembershipEndDate,
  getMembershipPaymentStatusLabel,
  getMembershipPeriodLabel,
  getMembershipStatus,
  getPaymentMethodLabel,
  getRemainingMembershipDays,
  getSubscriptionStatusLabel,
  resolveMembershipPeriodStart,
} from "@/lib/membership-utils";
import { createPartnerPaymentConversion } from "@/lib/partner-conversion-service";
import { assertCompanyAccess } from "@/lib/company-access";
import {
  expireStalePendingMembershipPayments,
  findPendingMembershipPayment,
} from "@/lib/payments/pending-membership-payment";
import { getSerializedPaytrCapabilities } from "@/lib/payments/paytr-capabilities";

export const DEFAULT_MEMBERSHIP_PLAN_CODE = "standard";

export class MembershipServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MembershipServiceError";
    this.status = status;
  }
}

export const createMembershipPaymentSchema = z.object({
  planId: z.string().optional(),
  period: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  paymentMethod: z
    .enum([
      "MANUAL",
      "BANK_TRANSFER",
      "CREDIT_CARD",
      "PAYTR",
      "IYZICO",
      "OTHER",
    ])
    .default("BANK_TRANSFER"),
});

export const updateMembershipPaymentAdminSchema = z.object({
  status: z.enum(["PAID", "FAILED", "CANCELLED", "REFUNDED"]),
  note: z.string().max(2000).optional(),
});

export const updateMembershipPlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  monthlyPrice: z.number().positive().optional(),
  quarterlyPrice: z.number().positive().optional(),
  semiAnnualPrice: z.number().positive().optional(),
  yearlyPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  features: z.array(z.string()).optional(),
});

function serializePlan(
  plan: Awaited<ReturnType<typeof getDefaultMembershipPlan>>
) {
  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    currency: plan.currency,
    isActive: plan.isActive,
    features: plan.features,
    prices: {
      MONTHLY: Number(plan.monthlyPrice),
      QUARTERLY: Number(plan.quarterlyPrice),
      SEMI_ANNUAL: Number(plan.semiAnnualPrice),
      YEARLY: Number(plan.yearlyPrice),
    },
  };
}

function serializePayment(payment: {
  id: string;
  period: MembershipPeriod | null;
  amount: { toString(): string } | number;
  currency: string;
  status: MembershipPaymentStatus;
  paymentMethod: MembershipPaymentMethod | null;
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date | null;
  invoiceNo: string | null;
  note: string | null;
  provider: string | null;
  type?: string | null;
  merchantOid?: string | null;
  providerStatus?: string | null;
  testMode?: boolean;
  amountMinor?: number | null;
  paymentRef: string | null;
  createdAt: Date;
}) {
  return {
    id: payment.id,
    period: payment.period,
    periodLabel: payment.period ? getMembershipPeriodLabel(payment.period) : "—",
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    statusLabel: getMembershipPaymentStatusLabel(payment.status),
    paymentMethod: payment.paymentMethod,
    paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
    periodStart: payment.periodStart.toISOString(),
    periodEnd: payment.periodEnd.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    invoiceNo: payment.invoiceNo,
    note: payment.note,
    provider: payment.provider,
    type: payment.type ?? null,
    merchantOid: payment.merchantOid ?? null,
    providerStatus: payment.providerStatus ?? null,
    testMode: payment.testMode ?? false,
    amountMinor: payment.amountMinor ?? null,
    paymentRef: payment.paymentRef,
    createdAt: payment.createdAt.toISOString(),
  };
}

export async function getDefaultMembershipPlan() {
  const plan = await db.membershipPlan.findFirst({
    where: {
      code: DEFAULT_MEMBERSHIP_PLAN_CODE,
      isActive: true,
    },
  });

  if (!plan) {
    throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
  }

  return plan;
}

export async function ensureCompanySubscription(companyId: string) {
  const existing = await db.companySubscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  if (existing) {
    return existing;
  }

  const [latestPayment, settings, plan] = await Promise.all([
    db.membershipPayment.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    db.companySettings.findUnique({ where: { companyId } }),
    getDefaultMembershipPlan(),
  ]);

  const now = new Date();
  const periodEnd =
    settings?.nextPaymentDate ?? latestPayment?.periodEnd ?? null;
  const periodStart = latestPayment?.periodStart ?? now;

  let status: "TRIAL" | "ACTIVE" | "EXPIRED" = "TRIAL";
  let trialEndsAt: Date | null = null;

  if (latestPayment?.provider === "TRIAL" && latestPayment.status === "PENDING") {
    status = periodEnd && periodEnd > now ? "TRIAL" : "EXPIRED";
    trialEndsAt = latestPayment.periodEnd;
  } else if (periodEnd && periodEnd > now) {
    status = "ACTIVE";
  } else if (periodEnd) {
    status = "EXPIRED";
  }

  return db.companySubscription.create({
    data: {
      companyId,
      planId: plan.id,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd ?? trialEndsAt,
      trialEndsAt,
      lastPaymentId:
        latestPayment?.status === "PAID" ? latestPayment.id : null,
    },
    include: { plan: true },
  });
}

export async function getMembershipBillingData(input: {
  companyId: string;
  userId: string;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  await expireStalePendingMembershipPayments(input.companyId);

  const [subscription, payments, plan, pendingPayment, paytrCapabilities] =
    await Promise.all([
      ensureCompanySubscription(input.companyId),
      db.membershipPayment.findMany({
        where: {
          companyId: input.companyId,
          provider: { not: "TRIAL" },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      getDefaultMembershipPlan(),
      findPendingMembershipPayment(input.companyId),
      Promise.resolve(getSerializedPaytrCapabilities()),
    ]);

  const effectiveStatus = getMembershipStatus(subscription);
  const remainingDays = getRemainingMembershipDays(subscription.currentPeriodEnd);

  const lastPaid = payments.find((payment) => payment.status === "PAID") ?? null;

  return {
    subscription: {
      status: effectiveStatus,
      statusLabel: getSubscriptionStatusLabel(effectiveStatus),
      plan: serializePlan(subscription.plan ?? plan),
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      remainingDays,
      isExpired: effectiveStatus === "EXPIRED",
    },
    lastPayment: lastPaid ? serializePayment(lastPaid) : null,
    pendingPayment: pendingPayment ? serializePayment(pendingPayment) : null,
    payments: payments.map(serializePayment),
    plan: serializePlan(plan),
    bankTransferInfo: {
      note: "Ödeme sonrası dekontu destek ekibine iletebilir veya admin onayı bekleyebilirsiniz.",
    },
    paytr: {
      capabilities: paytrCapabilities,
      subscription: {
        autoRenew: subscription.autoRenew,
        hasSavedCard: Boolean(subscription.defaultPaymentMethodId),
      },
    },
  };
}

export async function createMembershipPayment(input: {
  companyId: string;
  userId: string;
  planId?: string;
  period: MembershipPeriod;
  paymentMethod: MembershipPaymentMethod;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  const subscription = await ensureCompanySubscription(input.companyId);

  const plan = input.planId
    ? await db.membershipPlan.findFirst({
        where: { id: input.planId, isActive: true },
      })
    : await getDefaultMembershipPlan();

  if (!plan) {
    throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
  }

  const pendingPayment = await db.membershipPayment.findFirst({
    where: {
      companyId: input.companyId,
      status: "PENDING",
      provider: { not: "TRIAL" },
    },
  });

  if (pendingPayment) {
    throw new MembershipServiceError(
      "Bekleyen bir ödeme talebiniz zaten var. Lütfen önce onu tamamlayın veya iptal edin.",
      409
    );
  }

  const amount = calculateMembershipAmount(plan, input.period);
  const periodStart = resolveMembershipPeriodStart(
    subscription.currentPeriodEnd,
    new Date()
  );
  const periodEnd = calculateMembershipEndDate(periodStart, input.period);

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.membershipPayment.create({
      data: {
        companyId: input.companyId,
        planId: plan.id,
        period: input.period,
        periodStart,
        periodEnd,
        amount,
        currency: plan.currency,
        status: "PENDING",
        paymentMethod: input.paymentMethod,
        provider:
          input.paymentMethod === "PAYTR"
            ? "PayTR"
            : input.paymentMethod === "IYZICO"
              ? "iyzico"
              : input.paymentMethod === "BANK_TRANSFER"
                ? "BANK_TRANSFER"
                : "MANUAL",
        paymentRef: `MEM-${Date.now()}`,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        module: "settings",
        message: `Üyelik ödeme talebi oluşturuldu: ${getMembershipPeriodLabel(input.period)} · ₺${amount}`,
      },
    });

    return created;
  });

  return {
    paymentId: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    period: payment.period,
    periodLabel: payment.period ? getMembershipPeriodLabel(payment.period) : null,
    periodStart: payment.periodStart.toISOString(),
    periodEnd: payment.periodEnd.toISOString(),
    redirectUrl: null as string | null,
  };
}

async function applyPaidMembershipPayment(
  paymentId: string,
  actorUserId: string,
  note?: string
) {
  const payment = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    include: { company: true, plan: true },
  });

  if (!payment) {
    throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  if (payment.status === "PAID") {
    throw new MembershipServiceError("Bu ödeme zaten onaylanmış.", 400);
  }

  if (payment.status !== "PENDING") {
    throw new MembershipServiceError("Bu ödeme onaylanamaz.", 400);
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt: now,
        note: note ?? payment.note,
      },
    });

    await tx.companySubscription.upsert({
      where: { companyId: payment.companyId },
      create: {
        companyId: payment.companyId,
        planId: payment.planId,
        status: "ACTIVE",
        currentPeriodStart: payment.periodStart,
        currentPeriodEnd: payment.periodEnd,
        trialEndsAt: null,
        lastPaymentId: payment.id,
      },
      update: {
        planId: payment.planId ?? undefined,
        status: "ACTIVE",
        currentPeriodStart: payment.periodStart,
        currentPeriodEnd: payment.periodEnd,
        trialEndsAt: null,
        lastPaymentId: payment.id,
      },
    });

    await tx.companySettings.upsert({
      where: { companyId: payment.companyId },
      create: {
        companyId: payment.companyId,
        membershipStatus: "ACTIVE",
        lastPaymentDate: now,
        nextPaymentDate: payment.periodEnd,
        monthlyFee: payment.plan?.monthlyPrice ?? payment.amount,
      },
      update: {
        membershipStatus: "ACTIVE",
        lastPaymentDate: now,
        nextPaymentDate: payment.periodEnd,
      },
    });

    const periodLabel = payment.period
      ? getMembershipPeriodLabel(payment.period)
      : "Üyelik";

    await tx.activityLog.create({
      data: {
        companyId: payment.companyId,
        userId: actorUserId,
        action: "UPDATE",
        module: "settings",
        message: `Üyelik ödemesi onaylandı: ${payment.company.name} - ${periodLabel} - ₺${Number(payment.amount)}`,
      },
    });
  });

  await createPartnerPaymentConversion({
    companyId: payment.companyId,
    paymentAmount: Number(payment.amount),
    membershipPaymentId: payment.id,
  });

  return payment;
}

export async function updateMembershipPaymentAdmin(input: {
  paymentId: string;
  actorUserId: string;
  status: MembershipPaymentStatus;
  note?: string;
}) {
  if (input.status === "PAID") {
    const payment = await applyPaidMembershipPayment(
      input.paymentId,
      input.actorUserId,
      input.note
    );
    return serializePayment(payment);
  }

  const payment = await db.membershipPayment.findUnique({
    where: { id: input.paymentId },
    include: { company: true },
  });

  if (!payment) {
    throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  if (payment.status === "PAID") {
    throw new MembershipServiceError("Onaylanmış ödeme güncellenemez.", 400);
  }

  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: input.status,
        note: input.note ?? payment.note,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: payment.companyId,
        userId: input.actorUserId,
        action: "UPDATE",
        module: "admin",
        message: `Üyelik ödemesi ${getMembershipPaymentStatusLabel(input.status)}: ${payment.company.name}`,
      },
    });

    return saved;
  });

  return serializePayment(updated);
}

export async function listAdminMembershipPayments() {
  const payments = await db.membershipPayment.findMany({
    where: { provider: { not: "TRIAL" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      company: true,
      plan: true,
    },
  });

  return payments.map((payment) => ({
    ...serializePayment(payment),
    company: {
      id: payment.company.id,
      name: payment.company.name,
    },
    planName: payment.plan?.name ?? "Standart Paket",
  }));
}

export async function listMembershipPlans() {
  const plans = await db.membershipPlan.findMany({
    orderBy: { createdAt: "asc" },
  });

  return plans.map(serializePlan);
}

export async function updateMembershipPlan(
  planId: string,
  input: z.infer<typeof updateMembershipPlanSchema>
) {
  const plan = await db.membershipPlan.update({
    where: { id: planId },
    data: {
      name: input.name,
      description: input.description,
      monthlyPrice: input.monthlyPrice,
      quarterlyPrice: input.quarterlyPrice,
      semiAnnualPrice: input.semiAnnualPrice,
      yearlyPrice: input.yearlyPrice,
      isActive: input.isActive,
      features: input.features,
    },
  });

  return serializePlan(plan);
}

export async function getMembershipAlertForCompany(companyId: string) {
  const subscription = await ensureCompanySubscription(companyId);
  const status = getMembershipStatus(subscription);

  if (status === "EXPIRED") {
    return {
      type: "expired" as const,
      message:
        "Üyelik süreniz doldu. Kullanıma devam etmek için ödeme yapın.",
      actionUrl: "/settings/billing",
    };
  }

  const remainingDays = getRemainingMembershipDays(subscription.currentPeriodEnd);

  if (status === "TRIAL" && remainingDays <= 7) {
    return {
      type: "expiring" as const,
      message: `Deneme süreniz ${remainingDays} gün içinde bitiyor. Üyeliğinizi uzatmak için ödeme yapın.`,
      actionUrl: "/settings/billing",
    };
  }

  if (status === "ACTIVE" && remainingDays > 0 && remainingDays <= 7) {
    return {
      type: "expiring" as const,
      message: `Üyeliğiniz ${remainingDays} gün içinde sona erecek. Kesintisiz kullanım için ödeme yapın.`,
      actionUrl: "/settings/billing",
    };
  }

  return null;
}

const EFFECTIVE_MEMBERSHIP_STATUS_LABELS: Record<
  ReturnType<typeof getMembershipStatus>,
  string
> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  PAST_DUE: "Gecikmiş",
  GRACE_PERIOD: "Ek süre",
  CANCEL_AT_PERIOD_END: "İptal bekliyor",
  CANCELLED: "İptal",
  SUSPENDED: "Askıda",
};

export async function getSidebarMembershipSummary(companyId: string) {
  const subscription = await ensureCompanySubscription(companyId);
  const status = getMembershipStatus(subscription);
  const remainingDays = getRemainingMembershipDays(subscription.currentPeriodEnd);

  return {
    status,
    statusLabel: EFFECTIVE_MEMBERSHIP_STATUS_LABELS[status],
    remainingDays,
    isExpired: status === "EXPIRED",
  };
}
