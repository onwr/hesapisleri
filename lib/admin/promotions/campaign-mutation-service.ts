import "server-only";

import type { DiscountType, MembershipPeriod } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import type { CampaignScopeInput } from "@/lib/admin/promotions/promotion-types";
import { detectCampaignConflicts } from "@/lib/admin/promotions/campaign-conflict-service";

const scopeSchema = z.object({
  planId: z.string().optional().nullable(),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).optional().nullable(),
  companyId: z.string().optional().nullable(),
  partnerId: z.string().optional().nullable(),
  firstPaymentOnly: z.boolean().optional(),
  renewalAllowed: z.boolean().optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  internalNote: z.string().optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
  discountValue: z.number().int().positive(),
  overridePriceMinor: z.number().int().positive().optional().nullable(),
  minimumAmountMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().default("TRY"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  maxRedemptionsPerCompany: z.number().int().positive().optional().nullable(),
  newCustomersOnly: z.boolean().optional(),
  existingCustomersAllowed: z.boolean().optional(),
  firstPaymentOnly: z.boolean().optional(),
  renewalAllowed: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  stackable: z.boolean().optional(),
  priority: z.number().int().optional(),
  scopes: z.array(scopeSchema).optional(),
  publish: z.boolean().optional(),
});

async function logPromotionAction(input: {
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

function validateDiscount(type: DiscountType, value: number) {
  if (type === "PERCENTAGE" && (value <= 0 || value > 100)) {
    throw new PromotionError("Yüzde indirim 0-100 arasında olmalıdır.");
  }
  if (value <= 0) {
    throw new PromotionError("İndirim değeri sıfırdan büyük olmalıdır.");
  }
}

export async function createCampaign(actorUserId: string, input: z.infer<typeof createCampaignSchema>) {
  const parsed = createCampaignSchema.parse(input);
  validateDiscount(parsed.discountType, parsed.discountValue);

  const startsAt = new Date(parsed.startsAt);
  const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    throw new PromotionError("Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }

  const status = parsed.publish
    ? startsAt > new Date()
      ? "SCHEDULED"
      : "ACTIVE"
    : "DRAFT";

  const conflicts = await detectCampaignConflicts({
    discountType: parsed.discountType,
    priority: parsed.priority ?? 100,
    autoApply: parsed.autoApply ?? false,
    stackable: parsed.stackable ?? false,
    startsAt,
    endsAt,
    scopes: parsed.scopes ?? [],
  });
  const blocking = conflicts.find((c) => c.severity === "BLOCKING");
  if (blocking) {
    throw new PromotionError(blocking.message, 409);
  }

  const campaign = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.create({
      data: {
        name: parsed.name,
        code: parsed.code?.trim() || null,
        description: parsed.description,
        internalNote: parsed.internalNote,
        status,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
        overridePriceMinor: parsed.overridePriceMinor,
        minimumAmountMinor: parsed.minimumAmountMinor,
        currency: parsed.currency,
        startsAt,
        endsAt,
        maxRedemptions: parsed.maxRedemptions,
        maxRedemptionsPerCompany: parsed.maxRedemptionsPerCompany,
        newCustomersOnly: parsed.newCustomersOnly ?? false,
        existingCustomersAllowed: parsed.existingCustomersAllowed ?? true,
        firstPaymentOnly: parsed.firstPaymentOnly ?? false,
        renewalAllowed: parsed.renewalAllowed ?? true,
        autoApply: parsed.autoApply ?? false,
        stackable: parsed.stackable ?? false,
        priority: parsed.priority ?? 100,
        createdByUserId: actorUserId,
        publishedByUserId: parsed.publish ? actorUserId : null,
        publishedAt: parsed.publish ? new Date() : null,
        scopes: parsed.scopes?.length
          ? {
              create: parsed.scopes.map((s) => ({
                planId: s.planId,
                billingInterval: s.billingInterval as MembershipPeriod | undefined,
                companyId: s.companyId,
                partnerId: s.partnerId,
                firstPaymentOnly: s.firstPaymentOnly ?? false,
                renewalAllowed: s.renewalAllowed ?? true,
              })),
            }
          : undefined,
      },
    });
    return row;
  });

  await logPromotionAction({
    actorUserId,
    action: "CAMPAIGN_CREATED",
    message: `Kampanya oluşturuldu: ${campaign.name}`,
    payload: { campaignId: campaign.id },
  });

  return campaign;
}

export async function publishCampaign(actorUserId: string, campaignId: string) {
  const campaign = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new PromotionError("Kampanya bulunamadı.", 404);
  if (campaign.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kampanya yayınlanamaz.");
  }

  const status = campaign.startsAt > new Date() ? "SCHEDULED" : "ACTIVE";
  const updated = await db.membershipCampaign.update({
    where: { id: campaignId },
    data: {
      status,
      publishedByUserId: actorUserId,
      publishedAt: new Date(),
    },
  });

  await logPromotionAction({
    actorUserId,
    action: "CAMPAIGN_PUBLISHED",
    message: `Kampanya yayınlandı: ${updated.name}`,
    payload: { campaignId },
  });

  return updated;
}

export async function pauseCampaign(actorUserId: string, campaignId: string, reason?: string) {
  const updated = await db.membershipCampaign.update({
    where: { id: campaignId },
    data: { status: "PAUSED", pausedAt: new Date() },
  });

  await logPromotionAction({
    actorUserId,
    action: "CAMPAIGN_PAUSED",
    message: reason ?? `Kampanya duraklatıldı: ${updated.name}`,
    payload: { campaignId },
  });

  return updated;
}

export async function activateCampaign(actorUserId: string, campaignId: string) {
  const campaign = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new PromotionError("Kampanya bulunamadı.", 404);

  const status = campaign.startsAt > new Date() ? "SCHEDULED" : "ACTIVE";
  const updated = await db.membershipCampaign.update({
    where: { id: campaignId },
    data: { status, pausedAt: null },
  });

  await logPromotionAction({
    actorUserId,
    action: "CAMPAIGN_ACTIVATED",
    message: `Kampanya aktifleştirildi: ${updated.name}`,
    payload: { campaignId },
  });

  return updated;
}

export async function archiveCampaign(actorUserId: string, campaignId: string, reason?: string) {
  const updated = await db.membershipCampaign.update({
    where: { id: campaignId },
    data: { status: "ARCHIVED", archivedAt: new Date(), autoApply: false },
  });

  await logPromotionAction({
    actorUserId,
    action: "CAMPAIGN_ARCHIVED",
    message: reason ?? `Kampanya arşivlendi: ${updated.name}`,
    payload: { campaignId },
  });

  return updated;
}
