import "server-only";

import type { MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const RESERVATION_TTL_MS = 30 * 60 * 1000;

export async function reserveDiscountRedemptions(
  input: {
    companyId: string;
    subscriptionId?: string | null;
    paymentId: string;
    billingInterval: MembershipPeriod;
    campaignIds: string[];
    couponId?: string | null;
    campaignDiscounts: Array<{ id: string; amountMinor: number }>;
    couponDiscount?: { id: string; amountMinor: number } | null;
    idempotencyKey: string;
  },
  tx: Tx | typeof db = db
) {
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
  const created: string[] = [];

  for (const campaign of input.campaignDiscounts) {
    const existing = await tx.membershipDiscountRedemption.findFirst({
      where: {
        paymentId: input.paymentId,
        campaignId: campaign.id,
      },
    });
    if (existing) {
      created.push(existing.id);
      continue;
    }

    const row = await tx.membershipDiscountRedemption.create({
      data: {
        type: "CAMPAIGN",
        campaignId: campaign.id,
        companyId: input.companyId,
        subscriptionId: input.subscriptionId,
        paymentId: input.paymentId,
        billingInterval: input.billingInterval,
        amountMinor: campaign.amountMinor,
        status: "RESERVED",
        expiresAt,
        idempotencyKey: `${input.idempotencyKey}:campaign:${campaign.id}`,
      },
    });
    created.push(row.id);
  }

  if (input.couponDiscount) {
    const coupon = await tx.membershipCoupon.findUnique({
      where: { id: input.couponDiscount.id },
      select: { maxUsage: true, maxUsagePerCompany: true },
    });

    if (coupon?.maxUsage) {
      const used = await tx.membershipDiscountRedemption.count({
        where: {
          couponId: input.couponDiscount.id,
          status: { in: ["RESERVED", "FINALIZED"] },
        },
      });
      if (used >= coupon.maxUsage) {
        throw new Error("Kupon kullanım limiti doldu.");
      }
    }

    if (coupon?.maxUsagePerCompany) {
      const companyUsed = await tx.membershipDiscountRedemption.count({
        where: {
          couponId: input.couponDiscount.id,
          companyId: input.companyId,
          status: { in: ["RESERVED", "FINALIZED"] },
        },
      });
      if (companyUsed >= coupon.maxUsagePerCompany) {
        throw new Error("Firma kupon limiti doldu.");
      }
    }

    const existing = await tx.membershipDiscountRedemption.findFirst({
      where: {
        paymentId: input.paymentId,
        couponId: input.couponDiscount.id,
      },
    });
    if (existing) {
      created.push(existing.id);
    } else {
      const row = await tx.membershipDiscountRedemption.create({
        data: {
          type: "COUPON",
          couponId: input.couponDiscount.id,
          companyId: input.companyId,
          subscriptionId: input.subscriptionId,
          paymentId: input.paymentId,
          billingInterval: input.billingInterval,
          amountMinor: input.couponDiscount.amountMinor,
          status: "RESERVED",
          expiresAt,
          idempotencyKey: `${input.idempotencyKey}:coupon`,
        },
      });
      created.push(row.id);
    }
  }

  return created;
}

export async function finalizeDiscountRedemptions(paymentId: string, tx: Tx) {
  const rows = await tx.membershipDiscountRedemption.findMany({
    where: { paymentId, status: "RESERVED" },
  });

  for (const row of rows) {
    await tx.membershipDiscountRedemption.update({
      where: { id: row.id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });

    if (row.type === "COUPON" && row.couponId) {
      await tx.membershipCouponRedemption.create({
        data: {
          couponId: row.couponId,
          companyId: row.companyId,
          paymentId: row.paymentId,
          subscriptionId: row.subscriptionId,
          amountMinor: row.amountMinor,
          status: "FINALIZED",
        },
      });
    }
  }

  return rows.length;
}

export async function releaseDiscountRedemptions(paymentId: string, tx: Tx) {
  const result = await tx.membershipDiscountRedemption.updateMany({
    where: {
      paymentId,
      status: "RESERVED",
    },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
  });
  return result.count;
}

export async function cleanupExpiredReservations(limit = 100) {
  const now = new Date();
  const expired = await db.membershipDiscountRedemption.findMany({
    where: {
      status: "RESERVED",
      expiresAt: { lte: now },
    },
    take: limit,
    include: {
      payment: { select: { id: true, status: true } },
    },
  });

  let released = 0;
  for (const row of expired) {
    if (
      row.payment &&
      ["WAIT_CALLBACK", "UNKNOWN", "PENDING", "FORM_READY", "CREATED"].includes(
        row.payment.status
      )
    ) {
      continue;
    }

    await db.membershipDiscountRedemption.update({
      where: { id: row.id },
      data: { status: "RELEASED", releasedAt: now },
    });
    released += 1;
  }

  return { scanned: expired.length, released };
}

export async function countActiveRedemptions(input: {
  campaignId?: string;
  couponId?: string;
  companyId?: string;
}) {
  const where: Prisma.MembershipDiscountRedemptionWhereInput = {
    status: { in: ["RESERVED", "FINALIZED"] },
  };
  if (input.campaignId) where.campaignId = input.campaignId;
  if (input.couponId) where.couponId = input.couponId;
  if (input.companyId) where.companyId = input.companyId;

  return db.membershipDiscountRedemption.count({ where });
}
