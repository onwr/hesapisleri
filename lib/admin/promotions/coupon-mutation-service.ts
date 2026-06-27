import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import { normalizeCouponCode } from "@/lib/admin/promotions/coupon-utils";
import { createBulkCouponBatch, bulkCouponSchema } from "@/lib/admin/promotions/coupon-bulk-service";
import {
  adminCouponActivateSchema,
  adminCouponArchiveSchema,
  adminCouponCreateSchema,
  adminCouponTargetingSchema,
  adminCouponUpdateSchema,
  assertNoForbiddenCouponCreateKeys,
  assertNoForbiddenCouponPatchKeys,
  assertNoForbiddenCouponTargetingKeys,
} from "@/lib/admin/coupons/admin-coupon-schemas";
import { logAdminCouponAudit } from "@/lib/admin/coupons/admin-coupon-audit-service";
import { invalidateAdminCouponCaches } from "@/lib/admin/coupons/admin-coupon-cache";
import {
  assertCouponActivationAllowed,
  countFinalizedCouponRedemptions,
  detectCouponDiscountIssues,
  loadPlanMapForCouponPlans,
} from "@/lib/admin/coupons/admin-coupon-issue-service";
import { assertCouponCodeAllowed } from "@/lib/admin/coupons/admin-coupon-code-utils";

export { bulkCouponSchema };
export { createCouponSchema } from "./coupon-mutation-legacy-schema";

function validateDiscount(type: string, value: number) {
  const issues = detectCouponDiscountIssues(
    type as import("@prisma/client").DiscountType,
    value
  );
  if (issues.length) throw new PromotionError(issues[0]!.message);
}

function validateDateRange(startsAt: Date, expiresAt: Date | null) {
  if (expiresAt && expiresAt <= startsAt) {
    throw new PromotionError("Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }
}

async function assertPlanIdsValid(planIds: string[]) {
  const unique = [...new Set(planIds)];
  if (unique.length !== planIds.length) {
    throw new PromotionError("Aynı plan hedefi birden fazla kez tanımlı.");
  }
  const planMap = await loadPlanMapForCouponPlans(unique);
  for (const planId of unique) {
    const plan = planMap.get(planId);
    if (!plan) throw new PromotionError("Hedef plan bulunamadı.", 404);
    if (plan.planStatus === "ARCHIVED") {
      throw new PromotionError("Arşivlenmiş plan hedeflenemez.");
    }
  }
}

export async function createBulkCoupons(
  actorUserId: string,
  input: import("zod").infer<typeof bulkCouponSchema>
) {
  return createBulkCouponBatch(actorUserId, input);
}

export async function createCoupon(actorUserId: string, input: Record<string, unknown>) {
  assertNoForbiddenCouponCreateKeys(input);
  const parsed = adminCouponCreateSchema.parse(input);
  const code = normalizeCouponCode(parsed.code);

  try {
    assertCouponCodeAllowed(code);
  } catch (e) {
    throw new PromotionError(e instanceof Error ? e.message : "Geçersiz kupon kodu.");
  }

  const existing = await db.membershipCoupon.findUnique({ where: { code } });
  if (existing) throw new PromotionError("Bu kupon kodu zaten kullanılıyor.", 409);

  validateDiscount(parsed.discountType, parsed.discountValue);
  if (parsed.discountType === "FIXED_AMOUNT" && !parsed.currency) {
    throw new PromotionError("Sabit indirim için para birimi zorunludur.");
  }

  const startsAt = new Date(parsed.startsAt);
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  validateDateRange(startsAt, expiresAt);

  const planIds = parsed.planIds ?? [];
  if (planIds.length) await assertPlanIdsValid(planIds);

  const coupon = await db.$transaction(async (tx) => {
    const row = await tx.membershipCoupon.create({
      data: {
        code,
        name: parsed.name,
        description: parsed.description,
        status: "DRAFT",
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
        planScopes: planIds.length
          ? { create: planIds.map((planId) => ({ planId })) }
          : undefined,
      },
    });

    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_CREATED",
      couponId: row.id,
      displayMessage: `Kupon oluşturuldu: ${row.code}`,
      metadata: { reason: parsed.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminCouponCaches(coupon.id);
  return coupon;
}

export async function updateCoupon(
  actorUserId: string,
  couponId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenCouponPatchKeys(input);
  const parsed = adminCouponUpdateSchema.parse(input);

  const existing = await db.membershipCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new PromotionError("Kupon bulunamadı.", 404);
  if (existing.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kupon güncellenemez.");
  }

  const discountType = parsed.discountType ?? existing.discountType;
  const discountValue = parsed.discountValue ?? existing.discountValue;
  validateDiscount(discountType, discountValue);

  const startsAt = parsed.startsAt ? new Date(parsed.startsAt) : existing.startsAt;
  const expiresAt =
    parsed.expiresAt !== undefined
      ? parsed.expiresAt
        ? new Date(parsed.expiresAt)
        : null
      : existing.expiresAt;
  validateDateRange(startsAt, expiresAt);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCoupon.update({
      where: { id: couponId },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.discountType !== undefined ? { discountType: parsed.discountType } : {}),
        ...(parsed.discountValue !== undefined ? { discountValue: parsed.discountValue } : {}),
        ...(parsed.overridePriceMinor !== undefined
          ? { overridePriceMinor: parsed.overridePriceMinor }
          : {}),
        ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
        ...(parsed.startsAt !== undefined ? { startsAt } : {}),
        ...(parsed.expiresAt !== undefined ? { expiresAt } : {}),
        ...(parsed.maxUsage !== undefined ? { maxUsage: parsed.maxUsage } : {}),
        ...(parsed.maxUsagePerCompany !== undefined
          ? { maxUsagePerCompany: parsed.maxUsagePerCompany }
          : {}),
        ...(parsed.minimumAmountMinor !== undefined
          ? { minimumAmountMinor: parsed.minimumAmountMinor }
          : {}),
        ...(parsed.firstPaymentOnly !== undefined
          ? { firstPaymentOnly: parsed.firstPaymentOnly }
          : {}),
        ...(parsed.renewalAllowed !== undefined ? { renewalAllowed: parsed.renewalAllowed } : {}),
        ...(parsed.newCustomersOnly !== undefined
          ? { newCustomersOnly: parsed.newCustomersOnly }
          : {}),
        ...(parsed.stackable !== undefined ? { stackable: parsed.stackable } : {}),
      },
    });

    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_UPDATED",
      couponId,
      displayMessage: `Kupon güncellendi: ${row.code}`,
      metadata: { reason: parsed.reason ?? null, fields: Object.keys(parsed) },
      tx,
    });

    return row;
  });

  invalidateAdminCouponCaches(couponId);
  return updated;
}

export async function updateCouponTargeting(
  actorUserId: string,
  couponId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenCouponTargetingKeys(input);
  const parsed = adminCouponTargetingSchema.parse(input);
  await assertPlanIdsValid(parsed.planIds);

  const existing = await db.membershipCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new PromotionError("Kupon bulunamadı.", 404);
  if (existing.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kuponun hedeflemesi değiştirilemez.");
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.membershipCouponPlan.deleteMany({ where: { couponId } });
    if (parsed.planIds.length) {
      await tx.membershipCouponPlan.createMany({
        data: parsed.planIds.map((planId) => ({ couponId, planId })),
      });
    }

    const row = await tx.membershipCoupon.update({
      where: { id: couponId },
      data: {
        currency: parsed.currency,
        minimumAmountMinor: parsed.minimumAmountMinor,
        maxUsage: parsed.maxUsage,
        maxUsagePerCompany: parsed.maxUsagePerCompany,
        newCustomersOnly: parsed.newCustomersOnly,
        firstPaymentOnly: parsed.firstPaymentOnly,
        renewalAllowed: parsed.renewalAllowed,
        stackable: parsed.stackable,
        allowedIntervals: parsed.allowedIntervals as MembershipPeriod[],
        updatedAt: new Date(),
      },
      include: {
        planScopes: { include: { plan: { select: { id: true, name: true } } } },
      },
    });

    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_TARGETING_UPDATED",
      couponId,
      displayMessage: `Kupon hedeflemesi güncellendi: ${row.code}`,
      metadata: { reason: parsed.reason, planCount: parsed.planIds.length },
      tx,
    });

    return row;
  });

  invalidateAdminCouponCaches(couponId);
  return updated;
}

export async function pauseCoupon(actorUserId: string, couponId: string, reason?: string) {
  const existing = await db.membershipCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new PromotionError("Kupon bulunamadı.", 404);
  if (existing.status !== "ACTIVE") {
    throw new PromotionError("Yalnızca aktif kupon duraklatılabilir.");
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCoupon.update({
      where: { id: couponId },
      data: { status: "PAUSED" },
    });
    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_PAUSED",
      couponId,
      displayMessage: reason ?? `Kupon duraklatıldı: ${row.code}`,
      metadata: { reason: reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminCouponCaches(couponId);
  return updated;
}

export async function activateCoupon(
  actorUserId: string,
  couponId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminCouponActivateSchema.parse(body) : undefined;

  const coupon = await db.membershipCoupon.findUnique({
    where: { id: couponId },
    include: { planScopes: true, _count: { select: { discountUses: true } } },
  });
  if (!coupon) throw new PromotionError("Kupon bulunamadı.", 404);
  if (coupon.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kupon aktifleştirilemez.");
  }

  const finalizedCount = await countFinalizedCouponRedemptions(couponId);
  const planById = await loadPlanMapForCouponPlans(coupon.planScopes.map((s) => s.planId));

  await assertCouponActivationAllowed({
    id: coupon.id,
    status: coupon.status,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    currency: coupon.currency,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    maxUsage: coupon.maxUsage,
    maxUsagePerCompany: coupon.maxUsagePerCompany,
    stackable: coupon.stackable,
    allowedIntervals: coupon.allowedIntervals,
    planIds: coupon.planScopes.map((s) => s.planId),
    redemptionCountAll: coupon._count.discountUses,
    redemptionCountFinalized: finalizedCount,
    planById,
  });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCoupon.update({
      where: { id: couponId },
      data: { status: "ACTIVE" },
    });
    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_ACTIVATED",
      couponId,
      displayMessage: `Kupon aktifleştirildi: ${row.code}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminCouponCaches(couponId);
  return updated;
}

export async function archiveCoupon(
  actorUserId: string,
  couponId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminCouponArchiveSchema.parse(body) : undefined;

  const existing = await db.membershipCoupon.findUnique({ where: { id: couponId } });
  if (!existing) throw new PromotionError("Kupon bulunamadı.", 404);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCoupon.update({
      where: { id: couponId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await logAdminCouponAudit({
      userId: actorUserId,
      action: "COUPON_ARCHIVED",
      couponId,
      displayMessage: parsed?.reason ?? `Kupon arşivlendi: ${row.code}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminCouponCaches(couponId);
  return updated;
}
