import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";

export async function getCampaignAnalytics(campaignId: string) {
  const [statusGroups, planGroups, intervalGroups, payments] = await Promise.all([
    db.membershipDiscountRedemption.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
      _sum: { amountMinor: true },
    }),
    db.membershipDiscountRedemption.groupBy({
      by: ["billingInterval"],
      where: { campaignId, status: "FINALIZED" },
      _count: true,
      _sum: { amountMinor: true },
    }),
    db.membershipDiscountRedemption.groupBy({
      by: ["billingInterval"],
      where: { campaignId, status: "FINALIZED" },
      _count: true,
    }),
    db.membershipDiscountRedemption.findMany({
      where: { campaignId, status: "FINALIZED", paymentId: { not: null } },
      select: {
        payment: { select: { amountMinor: true, status: true } },
      },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count])
  ) as Record<string, number>;

  const reserved = countByStatus.RESERVED ?? 0;
  const finalized = countByStatus.FINALIZED ?? 0;
  const released = countByStatus.RELEASED ?? 0;
  const refunded = countByStatus.REFUNDED ?? 0;

  const totalDiscountMinor = statusGroups
    .filter((g) => g.status === "FINALIZED")
    .reduce((sum, g) => sum + (g._sum.amountMinor ?? 0), 0);

  const successfulPayments = payments.filter((p) => p.payment?.status === "PAID").length;
  const totalRevenueMinor = payments.reduce(
    (sum, p) => sum + (p.payment?.amountMinor ?? 0),
    0
  );
  const companyCount = await db.membershipDiscountRedemption.groupBy({
    by: ["companyId"],
    where: { campaignId, status: "FINALIZED" },
    _count: true,
  });

  const eligible = reserved + finalized;
  const conversionRate =
    eligible > 0 ? Math.round((finalized / eligible) * 1000) / 10 : 0;

  return {
    reserved,
    finalized,
    released,
    refunded,
    totalDiscountMinor,
    totalRevenueMinor,
    averagePaymentMinor:
      successfulPayments > 0 ? Math.round(totalRevenueMinor / successfulPayments) : 0,
    companyCount: companyCount.length,
    successfulPayments,
    conversionRate,
    conversionDefinition: "finalized / (reserved + finalized)",
    planDistribution: planGroups.map((g) => ({
      interval: g.billingInterval as MembershipPeriod,
      count: g._count,
      discountMinor: g._sum.amountMinor ?? 0,
    })),
    intervalDistribution: intervalGroups.map((g) => ({
      interval: g.billingInterval as MembershipPeriod,
      count: g._count,
    })),
  };
}

export async function getCouponAnalytics(couponId: string) {
  const [statusGroups, intervalGroups, payments, companyCount] = await Promise.all([
    db.membershipDiscountRedemption.groupBy({
      by: ["status"],
      where: { couponId },
      _count: true,
      _sum: { amountMinor: true },
    }),
    db.membershipDiscountRedemption.groupBy({
      by: ["billingInterval"],
      where: { couponId, status: "FINALIZED" },
      _count: true,
      _sum: { amountMinor: true },
    }),
    db.membershipDiscountRedemption.findMany({
      where: { couponId, status: "FINALIZED", paymentId: { not: null } },
      select: { payment: { select: { amountMinor: true, status: true } } },
    }),
    db.membershipDiscountRedemption.groupBy({
      by: ["companyId"],
      where: { couponId, status: "FINALIZED" },
      _count: true,
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count])
  ) as Record<string, number>;

  const reserved = countByStatus.RESERVED ?? 0;
  const finalized = countByStatus.FINALIZED ?? 0;
  const released = countByStatus.RELEASED ?? 0;
  const refunded = countByStatus.REFUNDED ?? 0;

  const totalDiscountMinor = statusGroups
    .filter((g) => g.status === "FINALIZED")
    .reduce((sum, g) => sum + (g._sum.amountMinor ?? 0), 0);

  const successfulPayments = payments.filter((p) => p.payment?.status === "PAID").length;
  const refundedPayments = payments.filter((p) => p.payment?.status === "REFUNDED").length;
  const totalRevenueMinor = payments.reduce(
    (sum, p) => sum + (p.payment?.amountMinor ?? 0),
    0
  );

  const eligible = reserved + finalized;
  const conversionRate =
    eligible > 0 ? Math.round((finalized / eligible) * 1000) / 10 : 0;

  return {
    reserved,
    finalized,
    released,
    refunded,
    totalDiscountMinor,
    totalRevenueMinor,
    averagePaymentMinor:
      successfulPayments > 0 ? Math.round(totalRevenueMinor / successfulPayments) : 0,
    companyCount: companyCount.length,
    successfulPayments,
    refundedPayments,
    conversionRate,
    conversionDefinition: "finalized / (reserved + finalized)",
    intervalDistribution: intervalGroups.map((g) => ({
      interval: g.billingInterval as MembershipPeriod,
      count: g._count,
      discountMinor: g._sum.amountMinor ?? 0,
    })),
  };
}
