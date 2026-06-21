import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { MembershipPeriod } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import { generateBulkCouponCode } from "@/lib/admin/promotions/coupon-utils";
import { escapeCsvCell } from "@/lib/admin/promotions/promotion-scope-utils";

const BULK_MAX = 500;
const EXPORT_TOKEN_TTL_MS = 15 * 60 * 1000;

export const bulkCouponSchema = z.object({
  prefix: z.string().min(2).max(12),
  count: z.number().int().min(1).max(BULK_MAX),
  codeLength: z.number().int().min(4).max(10).optional(),
  name: z.string().min(2),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
  discountValue: z.number().int().positive(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUsage: z.number().int().positive().optional(),
  maxUsagePerCompany: z.number().int().positive().optional(),
  allowedIntervals: z
    .array(z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]))
    .optional(),
  planIds: z.array(z.string()).optional(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createBulkCouponBatch(
  actorUserId: string,
  input: z.infer<typeof bulkCouponSchema>
) {
  const parsed = bulkCouponSchema.parse(input);
  const startsAt = new Date(parsed.startsAt);
  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;

  const batch = await db.$transaction(async (tx) => {
    const batchRow = await tx.membershipCouponBatch.create({
      data: {
        name: parsed.name,
        prefix: parsed.prefix.toUpperCase(),
        couponCount: parsed.count,
        createdByUserId: actorUserId,
      },
    });

    for (let i = 0; i < parsed.count; i += 1) {
      let code = "";
      let attempts = 0;
      while (attempts < 8) {
        code = generateBulkCouponCode(parsed.prefix, parsed.codeLength ?? 6);
        const exists = await tx.membershipCoupon.findUnique({ where: { code } });
        if (!exists) break;
        attempts += 1;
      }
      if (!code) throw new PromotionError("Benzersiz kupon kodu üretilemedi.");

      const coupon = await tx.membershipCoupon.create({
        data: {
          code,
          name: `${parsed.name} #${i + 1}`,
          status: "ACTIVE",
          discountType: parsed.discountType,
          discountValue: parsed.discountValue,
          startsAt,
          expiresAt,
          maxUsage: parsed.maxUsage ?? 1,
          maxUsagePerCompany: parsed.maxUsagePerCompany ?? 1,
          allowedIntervals: (parsed.allowedIntervals ?? []) as MembershipPeriod[],
          createdByUserId: actorUserId,
          batchId: batchRow.id,
          planScopes: parsed.planIds?.length
            ? { create: parsed.planIds.map((planId) => ({ planId })) }
            : undefined,
        },
      });

      await tx.membershipCouponBatchCode.create({
        data: { batchId: batchRow.id, couponId: coupon.id, code },
      });
    }

    return batchRow;
  });

  await db.activityLog.create({
    data: {
      userId: actorUserId,
      module: "admin-promotions",
      action: "COUPON_BULK_CREATED",
      message: JSON.stringify({ batchId: batch.id, count: parsed.count }),
    },
  });

  return { batchId: batch.id, count: parsed.count };
}

export async function issueBulkExportToken(batchId: string, actorUserId: string) {
  const batch = await db.membershipCouponBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new PromotionError("Toplu kupon batch bulunamadı.", 404);
  if (batch.downloadedAt) {
    throw new PromotionError("Bu batch için CSV zaten indirildi.", 410);
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + EXPORT_TOKEN_TTL_MS);

  await db.membershipCouponBatch.update({
    where: { id: batchId },
    data: {
      downloadTokenHash: hashToken(token),
      downloadExpiresAt: expiresAt,
    },
  });

  await db.activityLog.create({
    data: {
      userId: actorUserId,
      module: "admin-promotions",
      action: "COUPON_EXPORT",
      message: JSON.stringify({ batchId, expiresAt: expiresAt.toISOString() }),
    },
  });

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function exportBulkCouponCsv(batchId: string, token: string) {
  const batch = await db.membershipCouponBatch.findUnique({
    where: { id: batchId },
    include: {
      codes: {
        include: {
          batch: true,
        },
      },
      coupons: {
        include: { planScopes: { include: { plan: { select: { name: true } } } } },
      },
    },
  });

  if (!batch) throw new PromotionError("Batch bulunamadı.", 404);
  if (batch.downloadedAt) throw new PromotionError("CSV zaten indirildi.", 410);
  if (!batch.downloadTokenHash || !batch.downloadExpiresAt) {
    throw new PromotionError("İndirme tokenı oluşturulmamış.", 400);
  }
  if (batch.downloadExpiresAt < new Date()) {
    throw new PromotionError("İndirme tokenının süresi doldu.", 410);
  }
  if (batch.downloadTokenHash !== hashToken(token)) {
    throw new PromotionError("Geçersiz indirme tokenı.", 403);
  }

  const couponById = new Map(batch.coupons.map((c) => [c.id, c]));
  const header = [
    "Code",
    "Campaign/Batch",
    "Discount",
    "Valid From",
    "Valid Until",
    "Max Usage",
    "Plan Scope",
    "Interval Scope",
  ].join(",");

  const lines = batch.codes.map((row) => {
    const coupon = couponById.get(row.couponId);
    const discount =
      coupon?.discountType === "PERCENTAGE"
        ? `${coupon.discountValue}%`
        : String(coupon?.discountValue ?? "");
    const planScope = coupon?.planScopes.length
      ? coupon.planScopes.map((p) => p.plan.name).join(" + ")
      : "All";
    const intervalScope = coupon?.allowedIntervals.length
      ? coupon.allowedIntervals.join(" ")
      : "All";

    return [
      escapeCsvCell(row.code),
      escapeCsvCell(batch.name),
      escapeCsvCell(discount),
      escapeCsvCell(coupon?.startsAt.toISOString() ?? ""),
      escapeCsvCell(coupon?.expiresAt?.toISOString() ?? ""),
      escapeCsvCell(String(coupon?.maxUsage ?? "")),
      escapeCsvCell(planScope),
      escapeCsvCell(intervalScope),
    ].join(",");
  });

  await db.$transaction(async (tx) => {
    await tx.membershipCouponBatch.update({
      where: { id: batchId },
      data: { downloadedAt: new Date(), downloadTokenHash: null },
    });
    await tx.membershipCouponBatchCode.deleteMany({ where: { batchId } });
  });

  return `${header}\n${lines.join("\n")}\n`;
}
