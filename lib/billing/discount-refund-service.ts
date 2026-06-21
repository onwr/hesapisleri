import "server-only";

import type { DiscountRefundPolicy, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const DEFAULT_POLICY: DiscountRefundPolicy = "RELEASE_ON_FULL_REFUND";

export type RefundPolicyConfig = {
  refundPolicy: DiscountRefundPolicy;
  restoreUsageOnFullRefund: boolean;
  restoreUsageOnPartialRefund: boolean;
};

export function resolveRefundPolicy(input: RefundPolicyConfig): RefundPolicyConfig {
  return {
    refundPolicy: input.refundPolicy ?? DEFAULT_POLICY,
    restoreUsageOnFullRefund: input.restoreUsageOnFullRefund ?? true,
    restoreUsageOnPartialRefund: input.restoreUsageOnPartialRefund ?? false,
  };
}

export function shouldRestoreUsageOnRefund(input: {
  policy: RefundPolicyConfig;
  isFullRefund: boolean;
}) {
  const policy = resolveRefundPolicy(input.policy);
  if (policy.refundPolicy === "KEEP_REDEMPTION") return false;
  if (policy.refundPolicy === "MANUAL_REVIEW") return false;
  if (policy.refundPolicy === "RELEASE_ALWAYS") return true;
  if (input.isFullRefund) return policy.restoreUsageOnFullRefund;
  return policy.restoreUsageOnPartialRefund;
}

export async function restoreDiscountRedemptionsOnRefund(
  input: {
    paymentId: string;
    refundedAmountMinor: number;
    totalPaymentAmountMinor: number;
    actorUserId?: string;
  },
  tx: Tx = db
) {
  const isFullRefund = input.refundedAmountMinor >= input.totalPaymentAmountMinor;
  const rows = await tx.membershipDiscountRedemption.findMany({
    where: {
      paymentId: input.paymentId,
      status: "FINALIZED",
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          refundPolicy: true,
          restoreUsageOnFullRefund: true,
          restoreUsageOnPartialRefund: true,
          status: true,
        },
      },
      coupon: {
        select: {
          id: true,
          code: true,
          refundPolicy: true,
          restoreUsageOnFullRefund: true,
          restoreUsageOnPartialRefund: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  let restored = 0;
  for (const row of rows) {
    const entity = row.type === "CAMPAIGN" ? row.campaign : row.coupon;
    if (!entity) continue;

    const policy = resolveRefundPolicy({
      refundPolicy: entity.refundPolicy,
      restoreUsageOnFullRefund: entity.restoreUsageOnFullRefund,
      restoreUsageOnPartialRefund: entity.restoreUsageOnPartialRefund,
    });

    if (!shouldRestoreUsageOnRefund({ policy, isFullRefund })) {
      continue;
    }

    if (row.type === "COUPON" && row.coupon) {
      if (row.coupon.status === "ARCHIVED" || row.coupon.status === "EXPIRED") {
        continue;
      }
      if (row.coupon.expiresAt && row.coupon.expiresAt < new Date()) {
        continue;
      }
    }

    const updated = await tx.membershipDiscountRedemption.updateMany({
      where: { id: row.id, status: "FINALIZED" },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    if (updated.count === 0) continue;

    if (row.type === "COUPON" && row.couponId) {
      await tx.membershipCouponRedemption.updateMany({
        where: { paymentId: input.paymentId, couponId: row.couponId },
        data: { status: "REFUNDED" },
      });
    }

    restored += 1;

    await tx.activityLog.create({
      data: {
        userId: input.actorUserId,
        module: "admin-promotions",
        action: "REDEMPTION_REFUND_RESTORED",
        message: JSON.stringify({
          redemptionId: row.id,
          paymentId: input.paymentId,
          type: row.type,
          isFullRefund,
        }),
      },
    });
  }

  return { restored, scanned: rows.length };
}
