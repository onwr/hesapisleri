import { db } from "@/lib/prisma";
import { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/billing/membership-plan-constants";

export class MembershipPlanNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "Aktif üyelik paketi bulunamadı.") {
    super(message);
    this.name = "MembershipPlanNotFoundError";
  }
}

export async function resolveMembershipPlanById(planId: string | null | undefined) {
  if (!planId) return null;
  return db.membershipPlan.findUnique({ where: { id: planId } });
}

/**
 * Checkout / yeni abonelik bootstrap için ACTIVE plan.
 * Önce canonical kod, yoksa herhangi bir ACTIVE plan (sortOrder).
 */
export async function resolveActiveMembershipPlanForCheckout() {
  const byCode = await db.membershipPlan.findFirst({
    where: {
      code: DEFAULT_MEMBERSHIP_PLAN_CODE,
      planStatus: "ACTIVE",
    },
  });
  if (byCode) return byCode;

  const fallback = await db.membershipPlan.findFirst({
    where: { planStatus: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (fallback) return fallback;

  throw new MembershipPlanNotFoundError();
}

type SubscriptionWithPlan = {
  id: string;
  planId: string | null;
  plan: Awaited<ReturnType<typeof resolveMembershipPlanById>>;
};

/**
 * Billing ekranı için plan: abonelik planı (arşiv dahil), bekleyen ödeme veya checkout planı.
 */
export async function resolveBillingPlanForCompany(input: {
  companyId: string;
  subscription: SubscriptionWithPlan;
}) {
  if (input.subscription.plan) {
    return input.subscription.plan;
  }

  const planFromSubscriptionId = await resolveMembershipPlanById(input.subscription.planId);
  if (planFromSubscriptionId) {
    return planFromSubscriptionId;
  }

  const pendingAttempt = await db.paymentAttempt.findFirst({
    where: {
      companyId: input.companyId,
      provider: "SIPAY",
      status: { in: ["PENDING", "CHECKOUT_LINK_READY", "CREATED", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { planId: true },
  });
  if (pendingAttempt?.planId) {
    const plan = await resolveMembershipPlanById(pendingAttempt.planId);
    if (plan) return plan;
  }

  const latestPayment = await db.membershipPayment.findFirst({
    where: { companyId: input.companyId, planId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { planId: true },
  });
  if (latestPayment?.planId) {
    const plan = await resolveMembershipPlanById(latestPayment.planId);
    if (plan) return plan;
  }

  return resolveActiveMembershipPlanForCheckout();
}
