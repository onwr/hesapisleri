import type {
  MembershipPaymentMethod,
  MembershipPeriod,
  MembershipPaymentStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  calculateMembershipEndDate,
  getMembershipPaymentStatusLabel,
  getMembershipPeriodLabel,
  getMembershipStatus,
  getPaymentMethodLabel,
  getRemainingMembershipDays,
  getSubscriptionStatusLabel,
  resolveMembershipPeriodStart,
} from "@/lib/membership-utils";
import {
  buildCanonicalMembershipDisplay,
} from "@/lib/membership-display-dto";
import { createPartnerPaymentConversion } from "@/lib/partner-conversion-service";
import { assertCompanyAccess } from "@/lib/company-access";
import {
  expireStalePendingMembershipPayments,
  findPendingMembershipPayment,
} from "@/lib/payments/pending-membership-payment";
import { getSerializedPaytrCapabilities } from "@/lib/payments/paytr-capabilities";
import { getCheckoutProviderForClient } from "@/lib/payments/billing-provider-resolver";
import { getActivePendingChange } from "@/lib/billing/subscription-pending-change-service";
import {
  PriceResolutionError,
  resolveSubscriptionPrice,
} from "@/lib/billing/price-resolution-service";
import { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/billing/membership-plan-constants";
import { resolveActiveMembershipPlanForCheckout, resolveBillingPlanForCompany } from "@/lib/billing/membership-plan-resolution";

export { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/billing/membership-plan-constants";

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

export const updateMembershipPlanSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    shortDescription: z.string().max(500).nullable().optional(),
    sortOrder: z.number().int().optional(),
    trialEnabled: z.boolean().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
  })
  .strict();

/** @deprecated Generic PATCH daraltıldı — admin-plan-patch-service kullanın */
export async function updateMembershipPlan(
  planId: string,
  input: z.infer<typeof updateMembershipPlanSchema>
) {
  const { patchAdminPlanMetadata } = await import("@/lib/admin/plans/admin-plan-patch-service");
  const plan = await patchAdminPlanMetadata(planId, input);
  return serializePlan(plan);
}

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

const BILLING_CHECKOUT_PERIODS: MembershipPeriod[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
];

/**
 * Billing ekranı ve checkout aynı fiyat çözümleyicisini kullanır.
 * Kartlarda görünen tutar = Sipay'e giden tutar.
 */
async function serializeBillingPlanForCompany(
  plan: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    currency: string;
    isActive: boolean;
    features: string[];
    vatRate?: number;
    vatIncluded?: boolean;
  },
  companyId: string
) {
  const prices: Partial<Record<MembershipPeriod, number>> = {};
  const priceIds: Partial<Record<MembershipPeriod, string>> = {};
  let usesGrandfatheredPrice = false;

  for (const period of BILLING_CHECKOUT_PERIODS) {
    try {
      const resolved = await resolveSubscriptionPrice({
        companyId,
        planId: plan.id,
        billingInterval: period,
        isRenewal: true,
      });
      prices[period] = resolved.totalMinor / 100;
      priceIds[period] = resolved.planPriceId;
      if (resolved.priceSource === "GRANDFATHERED") {
        usesGrandfatheredPrice = true;
      }
    } catch (error) {
      if (!(error instanceof PriceResolutionError)) {
        throw error;
      }
    }
  }

  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    currency: plan.currency,
    isActive: plan.isActive,
    features: plan.features,
    prices: prices as Record<MembershipPeriod, number>,
    priceIds: priceIds as Record<MembershipPeriod, string>,
    pricesAreCheckoutTotals: true as const,
    vatRate: plan.vatRate ?? 20,
    vatIncluded: plan.vatIncluded ?? false,
    usesGrandfatheredPrice,
    priceLockNotice: usesGrandfatheredPrice
      ? "Aboneliğinizde kilitli (eski) fiyat uygulanıyor. Plan fiyatını düşürdüyseniz ve yeni fiyatı görmüyorsanız destek ile iletişime geçin."
      : null,
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
  try {
    return await resolveActiveMembershipPlanForCheckout();
  } catch (error) {
    if (error instanceof Error && error.name === "MembershipPlanNotFoundError") {
      throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
    }
    throw error;
  }
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

  // Billing bağlamında getDefaultMembershipPlan() ÇAĞIRMA — o fonksiyon
  // planStatus:"ACTIVE" şartı koyar ve plan arşivlenmişse throw eder.
  // Burada subscription'ın kendi planını kullanıyoruz; plan arşivlense de
  // mevcut abonelik görünmeye devam etmeli.
  // Firma değiştirince abonelik "kaybolmasın" diye — bkz. resolveUserCompanyEntitlement.
  // Abonelik kullanıcıya aittir; bu firmanın kendi geçerli aboneliği yoksa
  // kullanıcının erişebildiği başka bir firmadaki geçerli abonelik kullanılır
  // (yeni kayıt oluşturulmaz, yalnız hangi kaydın gösterileceği çözülür).
  const [
    { subscription, isSharedEntitlement, canManageBilling, sourceCompanyId },
    payments,
    pendingPayment,
    paytrCapabilities,
  ] = await Promise.all([
    resolveUserCompanyEntitlement({
      userId: input.userId,
      companyId: input.companyId,
    }),
    db.membershipPayment.findMany({
      where: {
        companyId: input.companyId,
        provider: { not: "TRIAL" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    findPendingMembershipPayment(input.companyId),
    Promise.resolve(getSerializedPaytrCapabilities()),
  ]);

  // Paylaşılan aboneliğin gerçek sahibi firmanın adı — yalnız UI mesajı için
  // ("Bu paket {firma adı} üzerinden kullanılmaktadır."). Faturalama
  // aksiyonları zaten sunucu tarafında sahibi firmanın companyId'sine göre
  // kilitli; bu isim yalnız bilgilendirme amaçlıdır.
  const sourceCompanyName = isSharedEntitlement
    ? (
        await db.company.findUnique({
          where: { id: sourceCompanyId },
          select: { name: true },
        })
      )?.name ?? null
    : null;

  // Tek canonical kaynak: aboneliğin GERÇEKTEN bağlı olduğu plan relation'ı.
  // Ayrı bir "katalog planı" arama/fallback mekanizması KULLANILMAZ — bu,
  // kod eşleşmesi yanlış olduğunda (ör. "standard" vs "standart") yanlışlıkla
  // arşivlenmiş eski planı göstermeye yol açıyordu.
  const subscriptionPlan = await resolveBillingPlanForCompany({
    companyId: input.companyId,
    subscription,
  }).catch((error) => {
    if (error instanceof Error && error.name === "MembershipPlanNotFoundError") {
      throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
    }
    throw error;
  });

  // Arşiv uyarısı YALNIZ aboneliğin gerçek planının durumundan hesaplanır.
  const isOnArchivedPlan = subscriptionPlan.planStatus === "ARCHIVED";

  // Zamanlanmış plan değişikliği (admin taşıması veya kullanıcı talebi)
  const activePendingChange = await getActivePendingChange(subscription.id);
  let scheduledPlanChange: { targetPlanName: string; effectiveAt: string } | null = null;
  if (activePendingChange?.targetPlanId) {
    const targetPlan = await db.membershipPlan.findUnique({
      where: { id: activePendingChange.targetPlanId },
      select: { name: true },
    });
    if (targetPlan) {
      scheduledPlanChange = {
        targetPlanName: targetPlan.name,
        effectiveAt: activePendingChange.effectiveAt.toISOString(),
      };
    }
  }

  const effectiveStatus = getMembershipStatus(subscription);
  const membershipDisplay = buildCanonicalMembershipDisplay({
    subscription,
    sourceCompanyId,
    isSharedEntitlement,
  });

  const lastPaid = payments.find((payment) => payment.status === "PAID") ?? null;
  const billingPlan = await serializeBillingPlanForCompany(
    subscriptionPlan,
    input.companyId
  );

  return {
    subscription: {
      status: effectiveStatus,
      statusLabel: getSubscriptionStatusLabel(effectiveStatus),
      // subscriptionPlan: aboneliğin gerçek planı — tek kaynak, fallback yok
      plan: { id: billingPlan.id, name: billingPlan.name },
      currentPeriodStart: membershipDisplay.currentPeriodStart,
      currentPeriodEnd: membershipDisplay.currentPeriodEnd,
      trialEndsAt: membershipDisplay.trialEndsAt,
      nextBillingDate: membershipDisplay.nextBillingDate,
      cancelAtPeriodEnd: membershipDisplay.cancelAtPeriodEnd,
      autoRenew: membershipDisplay.autoRenew,
      remainingDays: membershipDisplay.remainingDays,
      isExpired: membershipDisplay.isExpired,
      primaryDateLabel: membershipDisplay.primaryDateLabel,
      primaryDateDisplay: membershipDisplay.primaryDateDisplay,
      periodEndDisplay: membershipDisplay.periodEndDisplay,
    },
    isSharedEntitlement,
    canManageBilling,
    sharedEntitlementSourceCompanyName: sourceCompanyName,
    lastPayment: lastPaid ? serializePayment(lastPaid) : null,
    pendingPayment: pendingPayment ? serializePayment(pendingPayment) : null,
    payments: payments.map(serializePayment),
    // plan: seçim kartı, ödeme özeti ve checkout'un kullandığı TEK plan —
    // subscriptionPlan ile birebir aynı, ayrı bir "katalog planı" yok.
    plan: billingPlan,
    // Mevcut aboneliğin bağlı olduğu plan gerçekten ARCHIVED ise true
    isOnArchivedPlan,
    scheduledPlanChange,
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
    checkout: getCheckoutProviderForClient(),
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
        where: { id: input.planId, planStatus: "ACTIVE" },
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

  const resolved = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId: plan.id,
    billingInterval: input.period,
    isRenewal: subscription.status === "ACTIVE",
  });
  const amount = resolved.totalMinor / 100;
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

export async function updateMembershipPaymentAdmin(_input: {
  paymentId: string;
  actorUserId: string;
  status: MembershipPaymentStatus;
  note?: string;
}): Promise<never> {
  throw new MembershipServiceError(
    "Ödeme durumu doğrudan değiştirilemez. Yalnızca doğrulanmış callback, provider sync veya güvenli iade servisi kullanılabilir.",
    405
  );
}

export async function listAdminMembershipPayments(input?: {
  status?: string;
  companyId?: string;
  paymentId?: string;
}) {
  const where: Prisma.MembershipPaymentWhereInput = {
    provider: { not: "TRIAL" },
  };

  if (input?.status && input.status !== "ALL") {
    if (input.status === "REFUNDED") {
      where.status = { in: ["REFUNDED", "PARTIALLY_REFUNDED"] };
    } else {
      where.status = input.status as Prisma.EnumMembershipPaymentStatusFilter["equals"];
    }
  }

  if (input?.companyId) {
    where.companyId = input.companyId;
  }

  if (input?.paymentId) {
    where.id = input.paymentId;
  }

  const payments = await db.membershipPayment.findMany({
    where,
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

/**
 * ensureCompanySubscription güvenli sarmalayıcısı — panel/sidebar gibi her
 * sayfada render edilen okuma yollarını asla 500'e düşürmemeli. Eksik
 * default plan (katalog/ops sorunu) veya başka beklenmeyen bir hata olursa
 * null döner; çağıran taraf boş/nötr bir durum göstermelidir.
 * Bkz. lib/mobile/mobile-dashboard-service.ts'deki aynı .catch(() => null)
 * deseni — bu fonksiyon o deseni canonical hale getirir.
 */
async function ensureCompanySubscriptionSafe(companyId: string) {
  try {
    return await ensureCompanySubscription(companyId);
  } catch (error) {
    console.error("MEMBERSHIP_SUBSCRIPTION_RESOLVE_FAILED", {
      companyId,
      errorCode: error instanceof MembershipServiceError ? error.status : "UNKNOWN",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Ürün kuralı: abonelik KULLANICIYA aittir, tek tek firmalara değil. Bir
 * kullanıcının erişebildiği herhangi bir firmada geçerli (süresi dolmamış)
 * ücretli/deneme aboneliği varsa, firma değiştirdiğinde bu hak korunur —
 * yeniden satın alma istenmez. Bu fonksiyon YENİ bir CompanySubscription
 * kaydı OLUŞTURMAZ (duplicate yok) — yalnız hangi kaydın kullanılacağını
 * çözer (read-time resolution).
 *
 * Öncelik: (1) mevcut firmanın kendi geçerli aboneliği, (2) kullanıcının
 * erişebildiği diğer firmalardan en uygun geçerli abonelik (en uzak
 * currentPeriodEnd — en "değerli"/en son biteni), (3) hiçbiri yoksa mevcut
 * firma için normal (yeni TRIAL) bootstrap akışına düşer.
 */
export async function resolveUserCompanyEntitlement(input: {
  userId: string;
  companyId: string;
}) {
  const ownSubscription = await db.companySubscription.findUnique({
    where: { companyId: input.companyId },
    include: { plan: true },
  });

  if (ownSubscription && getMembershipStatus(ownSubscription) !== "EXPIRED") {
    return {
      subscription: ownSubscription,
      sourceCompanyId: input.companyId,
      activeCompanyId: input.companyId,
      isSharedEntitlement: false,
      canManageBilling: true,
    };
  }

  // Kullanıcının erişebildiği DİĞER firmalar arasında geçerli abonelik ara.
  const accessibleCompanyIds = await db.companyUser.findMany({
    where: {
      userId: input.userId,
      status: "ACTIVE",
      companyId: { not: input.companyId },
      company: { status: "ACTIVE" },
    },
    select: { companyId: true },
  });

  if (accessibleCompanyIds.length > 0) {
    const otherSubscriptions = await db.companySubscription.findMany({
      where: { companyId: { in: accessibleCompanyIds.map((c) => c.companyId) } },
      include: { plan: true },
    });

    // Paylaşıma uygun (shareable) durumlar: ACTIVE, TRIAL, GRACE_PERIOD,
    // CANCEL_AT_PERIOD_END (dönem sonuna kadar hâlâ kullanılabilir). EXPIRED,
    // CANCELLED, SUSPENDED, PAST_DUE hiçbir zaman başka firmaya paylaşılmaz.
    const SHAREABLE_STATUSES = new Set([
      "ACTIVE",
      "TRIAL",
      "GRACE_PERIOD",
      "CANCEL_AT_PERIOD_END",
    ]);
    const validOthers = otherSubscriptions.filter((sub) =>
      SHAREABLE_STATUSES.has(getMembershipStatus(sub))
    );

    if (validOthers.length > 0) {
      // En uzun kalan süreye sahip olanı tercih et (en "değerli" abonelik).
      const best = validOthers.reduce((a, b) => {
        const aEnd = a.currentPeriodEnd?.getTime() ?? 0;
        const bEnd = b.currentPeriodEnd?.getTime() ?? 0;
        return bEnd > aEnd ? b : a;
      });
      // Paylaşılan (borrowed) abonelik — bu firma sahibi değil. Kullanım
      // hakkı gösterilir ama faturalama aksiyonları (iptal, plan değişimi,
      // yenileme, ödeme yöntemi) yalnız sahibi firma üzerinden yapılabilir.
      // canManageBilling=false burada UI'da aksiyonların gizlenmesi için
      // kullanılır; ASIL güvenlik sınırı sunucu tarafında mutation route'ların
      // kendi companyId'sine göre sorgu yapması (bkz. auto-renew/payment-methods
      // route'ları) — bu sayede borrowing firma hiçbir zaman sahibi firmanın
      // subscription/payment kaydını mutasyona uğratamaz.
      return {
        subscription: best,
        sourceCompanyId: best.companyId,
        activeCompanyId: input.companyId,
        isSharedEntitlement: true,
        canManageBilling: false,
      };
    }

    // Kullanıcının başka firmalarında abonelik GEÇMİŞİ var ama hiçbiri
    // paylaşıma uygun değil (hepsi EXPIRED/CANCELLED/SUSPENDED/PAST_DUE).
    // Bu, kullanıcının aboneliğinin bittiği anlamına gelir — yeni firma için
    // "temiz sayfa" TRIAL bootstrap edip bu durumu MASKELEMİYORUZ. En son
    // biteni (en "yakın zamanda geçerli" olanı) restricted temel olarak
    // döndürüyoruz; getMembershipStatus bunu EXPIRED gösterip paneli kısıtlar.
    if (otherSubscriptions.length > 0) {
      const mostRecent = otherSubscriptions.reduce((a, b) => {
        const aEnd = a.currentPeriodEnd?.getTime() ?? 0;
        const bEnd = b.currentPeriodEnd?.getTime() ?? 0;
        return bEnd > aEnd ? b : a;
      });
      return {
        subscription: mostRecent,
        sourceCompanyId: mostRecent.companyId,
        activeCompanyId: input.companyId,
        isSharedEntitlement: false,
        canManageBilling: false,
      };
    }
  }

  // Kullanıcının hiçbir firmasında (kendi dahil) ŞİMDİYE KADAR bir abonelik
  // GEÇMİŞİ yok — bu gerçekten yeni bir kullanıcı/firma. Bu durumda normal
  // (yeni TRIAL) bootstrap akışına düş. Bu, yeni bir CompanySubscription
  // satırı OLUŞTURABİLİR (yalnız bu firma için, duplicate değil — zaten
  // hiçbiri yoktu).
  const bootstrapped = await ensureCompanySubscription(input.companyId);
  return {
    subscription: bootstrapped,
    sourceCompanyId: input.companyId,
    activeCompanyId: input.companyId,
    isSharedEntitlement: false,
    canManageBilling: true,
  };
}

/**
 * Kanonik faturalama mutasyon guard'ı. TÜM billing mutation route'ları
 * (cancel, resume, retry, auto-renew, plan change, payment method
 * create/update/delete/default, renewal, checkout başlatma) bu fonksiyonu
 * çağırmalı. UI'da aksiyonların gizlenmesi TEK koruma değildir — asıl
 * güvenlik sınırı burasıdır. Aboneliğin gerçek sahibi firma dışında hiçbir
 * mutasyon yapılamaz.
 */
export class BillingOwnershipError extends MembershipServiceError {
  constructor() {
    super("Bu abonelik başka bir firma üzerinden kullanılmaktadır.", 403);
  }
}

export async function assertCanManageActiveCompanyBilling(input: {
  userId: string;
  activeCompanyId: string;
}) {
  const entitlement = await resolveUserCompanyEntitlement({
    userId: input.userId,
    companyId: input.activeCompanyId,
  });

  if (
    entitlement.isSharedEntitlement ||
    entitlement.sourceCompanyId !== input.activeCompanyId
  ) {
    throw new BillingOwnershipError();
  }

  return entitlement;
}

async function resolveUserCompanyEntitlementSafe(input: {
  userId?: string;
  companyId: string;
}) {
  if (!input.userId) {
    return ensureCompanySubscriptionSafe(input.companyId);
  }

  try {
    const resolved = await resolveUserCompanyEntitlement({
      userId: input.userId,
      companyId: input.companyId,
    });
    return resolved.subscription;
  } catch (error) {
    console.error("MEMBERSHIP_SUBSCRIPTION_RESOLVE_FAILED", {
      companyId: input.companyId,
      userId: input.userId,
      errorCode: error instanceof MembershipServiceError ? error.status : "UNKNOWN",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveMembershipDisplaySafe(input: {
  userId?: string;
  companyId: string;
}) {
  if (!input.userId) {
    const subscription = await ensureCompanySubscriptionSafe(input.companyId);
    if (!subscription) return null;
    return buildCanonicalMembershipDisplay({
      subscription,
      sourceCompanyId: input.companyId,
      isSharedEntitlement: false,
    });
  }

  try {
    const resolved = await resolveUserCompanyEntitlement({
      userId: input.userId,
      companyId: input.companyId,
    });
    return buildCanonicalMembershipDisplay({
      subscription: resolved.subscription,
      sourceCompanyId: resolved.sourceCompanyId,
      isSharedEntitlement: resolved.isSharedEntitlement,
    });
  } catch (error) {
    console.error("MEMBERSHIP_SUBSCRIPTION_RESOLVE_FAILED", {
      companyId: input.companyId,
      userId: input.userId,
      errorCode: error instanceof MembershipServiceError ? error.status : "UNKNOWN",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getMembershipAlertForCompany(
  companyId: string,
  userId?: string
) {
  const membershipDisplay = await resolveMembershipDisplaySafe({ companyId, userId });
  if (!membershipDisplay) return null;

  const status = membershipDisplay.subscriptionStatus;
  const remainingDays = membershipDisplay.remainingDays;

  if (status === "EXPIRED") {
    return {
      type: "expired" as const,
      message: membershipDisplay.primaryDateDisplay
        ? `Üyelik süreniz ${membershipDisplay.primaryDateDisplay} tarihinde doldu. Kullanıma devam etmek için ödeme yapın.`
        : "Üyelik süreniz doldu. Kullanıma devam etmek için ödeme yapın.",
      actionUrl: "/settings/billing",
      membershipDisplay,
    };
  }

  if (status === "TRIAL" && remainingDays <= 7) {
    return {
      type: "expiring" as const,
      message: membershipDisplay.primaryDateDisplay
        ? `Deneme süreniz ${membershipDisplay.primaryDateDisplay} tarihinde bitiyor (${remainingDays} gün kaldı). Üyeliğinizi uzatmak için ödeme yapın.`
        : `Deneme süreniz ${remainingDays} gün içinde bitiyor. Üyeliğinizi uzatmak için ödeme yapın.`,
      actionUrl: "/settings/billing",
      membershipDisplay,
    };
  }

  if (status === "ACTIVE" && remainingDays > 0 && remainingDays <= 7) {
    return {
      type: "expiring" as const,
      message: membershipDisplay.primaryDateDisplay
        ? `${membershipDisplay.primaryDateLabel} ${membershipDisplay.primaryDateDisplay} (${remainingDays} gün kaldı). Kesintisiz kullanım için ödeme yapın.`
        : `Üyeliğiniz ${remainingDays} gün içinde sona erecek. Kesintisiz kullanım için ödeme yapın.`,
      actionUrl: "/settings/billing",
      membershipDisplay,
    };
  }

  return null;
}

export async function getSidebarMembershipSummary(companyId: string, userId?: string) {
  const membershipDisplay = await resolveMembershipDisplaySafe({ companyId, userId });
  if (!membershipDisplay) {
    return {
      status: "UNKNOWN" as const,
      statusLabel: "Kurulum bekleniyor",
      remainingDays: 0,
      isExpired: false,
      periodEndLabel: null,
      primaryDateLabel: null,
      primaryDateDisplay: null,
      policyNote:
        "Üyelik paketi bilgisi şu anda alınamadı. Destek ekibimizle iletişime geçin.",
    };
  }

  const status = membershipDisplay.subscriptionStatus;

  let policyNote: string | null = null;
  if (status === "EXPIRED") {
    policyNote =
      "Süre dolduğunda yeni işlem kısıtlanır; mevcut verileriniz korunur. Devam için ödeme yapın.";
  } else if (status === "TRIAL") {
    policyNote =
      "Deneme süresi bitince üyelik ödemesi gerekir; aksi halde erişim kısıtlanır.";
  } else if (status === "GRACE_PERIOD" || status === "PAST_DUE") {
    policyNote =
      "Ödeme gecikmesi var; kesintisiz kullanım için faturalandırmayı tamamlayın.";
  }

  return {
    status,
    statusLabel: membershipDisplay.statusLabel,
    remainingDays: membershipDisplay.remainingDays,
    isExpired: membershipDisplay.isExpired,
    periodEndLabel: membershipDisplay.primaryDateDisplay,
    primaryDateLabel: membershipDisplay.primaryDateLabel,
    primaryDateDisplay: membershipDisplay.primaryDateDisplay,
    policyNote,
  };
}
