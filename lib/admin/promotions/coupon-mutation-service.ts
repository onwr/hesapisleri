import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import { normalizeCouponCode } from "@/lib/admin/promotions/coupon-utils";
import { createBulkCouponBatch, bulkCouponSchema } from "@/lib/admin/promotions/coupon-bulk-service";

export { bulkCouponSchema };

export const createCouponSchema = z.object({
  code: z.string().min(3).max(32),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
  discountValue: z.number().int().positive(),
  overridePriceMinor: z.number().int().positive().optional().nullable(),
  currency: z.string().default("TRY"),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUsage: z.number().int().positive().optional().nullable(),
  maxUsagePerCompany: z.number().int().positive().optional(),
  minimumAmountMinor: z.number().int().min(0).optional().nullable(),
  firstPaymentOnly: z.boolean().optional(),
  renewalAllowed: z.boolean().optional(),
  newCustomersOnly: z.boolean().optional(),
  stackable: z.boolean().optional(),
  allowedIntervals: z
    .array(z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]))
    .optional(),
  planIds: z.array(z.string()).optional(),
  activate: z.boolean().optional(),
});

export async function createBulkCoupons(
  actorUserId: string,
  input: z.infer<typeof bulkCouponSchema>
) {
  return createBulkCouponBatch(actorUserId, input);
}

async function logCouponAction(input: {
  actorUserId: string;
  action: string;
  message: string;
  payload?: unknown;
}) {
  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      module: "admin-promotions",
      action: input.action,
      message: input.payload ? `${input.message} ${JSON.stringify(input.payload)}` : input.message,
    },
  });
}

export async function createCoupon(actorUserId: string, input: z.infer<typeof createCouponSchema>) {
  const parsed = createCouponSchema.parse(input);
  const code = normalizeCouponCode(parsed.code);

  const existing = await db.membershipCoupon.findUnique({ where: { code } });
  if (existing) throw new PromotionError("Bu kupon kodu zaten kullanılıyor.", 409);

  const startsAt = new Date(parsed.startsAt);
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && expiresAt <= startsAt) {
    throw new PromotionError("Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }

  const coupon = await db.membershipCoupon.create({
    data: {
      code,
      name: parsed.name,
      description: parsed.description,
      status: parsed.activate ? "ACTIVE" : "DRAFT",
      discountType: parsed.discountType,
      discountValue: parsed.discountValue,
      overridePriceMinor: parsed.overridePriceMinor,
      currency: parsed.currency,
      startsAt,
      expiresAt,
      maxUsage: parsed.maxUsage,
      maxUsagePerCompany: parsed.maxUsagePerCompany ?? 1,
      minimumAmountMinor: parsed.minimumAmountMinor,
      firstPaymentOnly: parsed.firstPaymentOnly ?? true,
      renewalAllowed: parsed.renewalAllowed ?? false,
      newCustomersOnly: parsed.newCustomersOnly ?? false,
      stackable: parsed.stackable ?? false,
      allowedIntervals: (parsed.allowedIntervals ?? []) as MembershipPeriod[],
      createdByUserId: actorUserId,
      planScopes: parsed.planIds?.length
        ? { create: parsed.planIds.map((planId) => ({ planId })) }
        : undefined,
    },
  });

  await logCouponAction({
    actorUserId,
    action: "COUPON_CREATED",
    message: `Kupon oluşturuldu: ${coupon.code}`,
    payload: { couponId: coupon.id },
  });

  return coupon;
}

export async function pauseCoupon(actorUserId: string, couponId: string) {
  const updated = await db.membershipCoupon.update({
    where: { id: couponId },
    data: { status: "PAUSED" },
  });
  await logCouponAction({
    actorUserId,
    action: "COUPON_PAUSED",
    message: `Kupon duraklatıldı: ${updated.code}`,
    payload: { couponId },
  });
  return updated;
}

export async function activateCoupon(actorUserId: string, couponId: string) {
  const updated = await db.membershipCoupon.update({
    where: { id: couponId },
    data: { status: "ACTIVE" },
  });
  await logCouponAction({
    actorUserId,
    action: "COUPON_ACTIVATED",
    message: `Kupon aktifleştirildi: ${updated.code}`,
    payload: { couponId },
  });
  return updated;
}

export async function archiveCoupon(actorUserId: string, couponId: string) {
  const updated = await db.membershipCoupon.update({
    where: { id: couponId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await logCouponAction({
    actorUserId,
    action: "COUPON_ARCHIVED",
    message: `Kupon arşivlendi: ${updated.code}`,
    payload: { couponId },
  });
  return updated;
}
