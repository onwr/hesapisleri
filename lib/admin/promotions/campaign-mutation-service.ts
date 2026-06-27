import "server-only";

import type { DiscountType, MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import type { CampaignScopeInput } from "@/lib/admin/promotions/promotion-types";
import { detectCampaignConflicts } from "@/lib/admin/promotions/campaign-conflict-service";
import {
  adminCampaignActivateSchema,
  adminCampaignArchiveSchema,
  adminCampaignCreateSchema,
  adminCampaignTargetingSchema,
  adminCampaignUpdateSchema,
  assertNoForbiddenCampaignCreateKeys,
  assertNoForbiddenCampaignPatchKeys,
  assertNoForbiddenCampaignTargetingKeys,
} from "@/lib/admin/campaigns/admin-campaign-schemas";
import { logAdminCampaignAudit } from "@/lib/admin/campaigns/admin-campaign-audit-service";
import { invalidateAdminCampaignCaches } from "@/lib/admin/campaigns/admin-campaign-cache";
import {
  assertCampaignActivationAllowed,
  countFinalizedRedemptions,
  detectDiscountIssues,
  loadPlanMapForScopes,
} from "@/lib/admin/campaigns/admin-campaign-issue-service";

export { createCampaignSchema } from "./campaign-mutation-legacy-schema";

function validateDiscount(type: DiscountType, value: number) {
  const issues = detectDiscountIssues(type, value);
  if (issues.length) {
    throw new PromotionError(issues[0]!.message);
  }
}

function validateDateRange(startsAt: Date, endsAt: Date | null) {
  if (endsAt && endsAt <= startsAt) {
    throw new PromotionError("Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }
}

async function assertScopesValid(scopes: CampaignScopeInput[]) {
  const normalized = scopes.map((s) => ({
    planId: s.planId ?? null,
    billingInterval: s.billingInterval ?? null,
    companyId: s.companyId ?? null,
    partnerId: s.partnerId ?? null,
  }));
  const planMap = await loadPlanMapForScopes(normalized);
  for (const scope of scopes) {
    if (!scope.planId) continue;
    const plan = planMap.get(scope.planId);
    if (!plan) throw new PromotionError("Hedef plan bulunamadı.", 404);
    if (plan.planStatus === "ARCHIVED") {
      throw new PromotionError("Arşivlenmiş plan hedeflenemez.");
    }
  }
  const keys = new Set<string>();
  for (const s of scopes) {
    const key = [s.planId ?? "", s.billingInterval ?? "", s.companyId ?? "", s.partnerId ?? ""].join("|");
    if (keys.has(key)) {
      throw new PromotionError("Aynı hedef kapsam birden fazla kez tanımlı.");
    }
    keys.add(key);
  }
}

export async function createCampaign(
  actorUserId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenCampaignCreateKeys(input);
  const parsed = adminCampaignCreateSchema.parse(input);
  validateDiscount(parsed.discountType, parsed.discountValue);

  const startsAt = new Date(parsed.startsAt);
  const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
  validateDateRange(startsAt, endsAt);

  const scopes = parsed.scopes ?? [];
  if (scopes.length) await assertScopesValid(scopes);

  const conflicts = await detectCampaignConflicts({
    discountType: parsed.discountType,
    priority: parsed.priority ?? 100,
    autoApply: parsed.autoApply ?? false,
    stackable: parsed.stackable ?? false,
    startsAt,
    endsAt,
    scopes,
  });
  const blocking = conflicts.find((c) => c.severity === "BLOCKING");
  if (blocking) throw new PromotionError(blocking.message, 409);

  const campaign = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.create({
      data: {
        name: parsed.name,
        code: parsed.code?.trim() || null,
        description: parsed.description,
        internalNote: parsed.internalNote ?? parsed.reason ?? null,
        status: "DRAFT",
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
        scopes: scopes.length
          ? {
              create: scopes.map((s) => ({
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

    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_CREATED",
      campaignId: row.id,
      displayMessage: `Kampanya oluşturuldu: ${row.name}`,
      metadata: { reason: parsed.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminCampaignCaches(campaign.id);
  return campaign;
}

export async function updateCampaign(
  actorUserId: string,
  campaignId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenCampaignPatchKeys(input);
  const parsed = adminCampaignUpdateSchema.parse(input);

  const existing = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new PromotionError("Kampanya bulunamadı.", 404);
  if (existing.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kampanya güncellenemez.");
  }

  const discountType = parsed.discountType ?? existing.discountType;
  const discountValue = parsed.discountValue ?? existing.discountValue;
  validateDiscount(discountType, discountValue);

  const startsAt = parsed.startsAt ? new Date(parsed.startsAt) : existing.startsAt;
  const endsAt =
    parsed.endsAt !== undefined
      ? parsed.endsAt
        ? new Date(parsed.endsAt)
        : null
      : existing.endsAt;
  validateDateRange(startsAt, endsAt);

  const data: Prisma.MembershipCampaignUpdateInput = {};
  if (parsed.name !== undefined) data.name = parsed.name.trim();
  if (parsed.code !== undefined) data.code = parsed.code?.trim() || null;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.internalNote !== undefined) data.internalNote = parsed.internalNote;
  if (parsed.discountType !== undefined) data.discountType = parsed.discountType;
  if (parsed.discountValue !== undefined) data.discountValue = parsed.discountValue;
  if (parsed.overridePriceMinor !== undefined) data.overridePriceMinor = parsed.overridePriceMinor;
  if (parsed.minimumAmountMinor !== undefined) data.minimumAmountMinor = parsed.minimumAmountMinor;
  if (parsed.currency !== undefined) data.currency = parsed.currency;
  if (parsed.startsAt !== undefined) data.startsAt = startsAt;
  if (parsed.endsAt !== undefined) data.endsAt = endsAt;
  if (parsed.maxRedemptions !== undefined) data.maxRedemptions = parsed.maxRedemptions;
  if (parsed.maxRedemptionsPerCompany !== undefined) {
    data.maxRedemptionsPerCompany = parsed.maxRedemptionsPerCompany;
  }
  if (parsed.newCustomersOnly !== undefined) data.newCustomersOnly = parsed.newCustomersOnly;
  if (parsed.existingCustomersAllowed !== undefined) {
    data.existingCustomersAllowed = parsed.existingCustomersAllowed;
  }
  if (parsed.firstPaymentOnly !== undefined) data.firstPaymentOnly = parsed.firstPaymentOnly;
  if (parsed.renewalAllowed !== undefined) data.renewalAllowed = parsed.renewalAllowed;
  if (parsed.autoApply !== undefined) data.autoApply = parsed.autoApply;
  if (parsed.stackable !== undefined) data.stackable = parsed.stackable;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.reason && parsed.internalNote === undefined) {
    data.internalNote = parsed.reason;
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.update({ where: { id: campaignId }, data });
    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_UPDATED",
      campaignId,
      displayMessage: `Kampanya güncellendi: ${row.name}`,
      metadata: { reason: parsed.reason ?? null, fields: Object.keys(parsed) },
      tx,
    });
    return row;
  });

  invalidateAdminCampaignCaches(campaignId);
  return updated;
}

export async function updateCampaignTargeting(
  actorUserId: string,
  campaignId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenCampaignTargetingKeys(input);
  const parsed = adminCampaignTargetingSchema.parse(input);
  await assertScopesValid(parsed.scopes);

  const existing = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new PromotionError("Kampanya bulunamadı.", 404);
  if (existing.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kampanyanın hedeflemesi değiştirilemez.");
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.membershipCampaignScope.deleteMany({ where: { campaignId } });
    if (parsed.scopes.length) {
      await tx.membershipCampaignScope.createMany({
        data: parsed.scopes.map((s) => ({
          campaignId,
          planId: s.planId,
          billingInterval: s.billingInterval as MembershipPeriod | undefined,
          companyId: s.companyId,
          partnerId: s.partnerId,
          firstPaymentOnly: s.firstPaymentOnly ?? false,
          renewalAllowed: s.renewalAllowed ?? true,
        })),
      });
    }
    const row = await tx.membershipCampaign.update({
      where: { id: campaignId },
      data: {
        currency: parsed.currency,
        minimumAmountMinor: parsed.minimumAmountMinor,
        maxRedemptions: parsed.maxRedemptions,
        maxRedemptionsPerCompany: parsed.maxRedemptionsPerCompany,
        newCustomersOnly: parsed.newCustomersOnly,
        existingCustomersAllowed: parsed.existingCustomersAllowed,
        firstPaymentOnly: parsed.firstPaymentOnly,
        renewalAllowed: parsed.renewalAllowed,
        autoApply: parsed.autoApply,
        stackable: parsed.stackable,
        priority: parsed.priority,
        updatedAt: new Date(),
      },
      include: {
        scopes: {
          include: {
            plan: { select: { id: true, name: true } },
            company: { select: { id: true, name: true } },
            partner: { select: { id: true, fullName: true, referralCode: true } },
          },
        },
      },
    });
    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_TARGETING_UPDATED",
      campaignId,
      displayMessage: `Kampanya hedeflemesi güncellendi: ${row.name}`,
      metadata: { reason: parsed.reason, scopeCount: parsed.scopes.length },
      tx,
    });
    return row;
  });

  invalidateAdminCampaignCaches(campaignId);
  return updated;
}

export async function publishCampaign(
  actorUserId: string,
  campaignId: string,
  body?: Record<string, unknown>
) {
  const activateBody =
    body && Object.keys(body).length > 0
      ? body
      : { reason: "Yayınla", confirm: true as const };
  return activateCampaign(actorUserId, campaignId, activateBody);
}

export async function pauseCampaign(actorUserId: string, campaignId: string, reason?: string) {
  const existing = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new PromotionError("Kampanya bulunamadı.", 404);
  if (!["ACTIVE", "SCHEDULED"].includes(existing.status)) {
    throw new PromotionError("Yalnızca aktif veya zamanlanmış kampanya duraklatılabilir.");
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_PAUSED",
      campaignId,
      displayMessage: reason ?? `Kampanya duraklatıldı: ${row.name}`,
      metadata: { reason: reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminCampaignCaches(campaignId);
  return updated;
}

export async function activateCampaign(
  actorUserId: string,
  campaignId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0
      ? adminCampaignActivateSchema.parse(body)
      : undefined;

  const campaign = await db.membershipCampaign.findUnique({
    where: { id: campaignId },
    include: { scopes: true, _count: { select: { redemptions: true } } },
  });
  if (!campaign) throw new PromotionError("Kampanya bulunamadı.", 404);
  if (campaign.status === "ARCHIVED") {
    throw new PromotionError("Arşivlenmiş kampanya aktifleştirilemez.");
  }

  const finalizedCount = await countFinalizedRedemptions(campaignId);
  const planById = await loadPlanMapForScopes(campaign.scopes);

  await assertCampaignActivationAllowed({
    id: campaign.id,
    status: campaign.status,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
    overridePriceMinor: campaign.overridePriceMinor,
    currency: campaign.currency,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    maxRedemptions: campaign.maxRedemptions,
    autoApply: campaign.autoApply,
    stackable: campaign.stackable,
    priority: campaign.priority,
    scopes: campaign.scopes,
    redemptionCountAll: campaign._count.redemptions,
    redemptionCountFinalized: finalizedCount,
    planById,
  });

  const status = campaign.startsAt > new Date() ? "SCHEDULED" : "ACTIVE";

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        pausedAt: null,
        publishedByUserId: actorUserId,
        publishedAt: new Date(),
      },
    });
    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_ACTIVATED",
      campaignId,
      displayMessage: `Kampanya aktifleştirildi: ${row.name}`,
      metadata: { reason: parsed?.reason ?? null, targetStatus: status },
      tx,
    });
    return row;
  });

  invalidateAdminCampaignCaches(campaignId);
  return updated;
}

export async function archiveCampaign(
  actorUserId: string,
  campaignId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0
      ? adminCampaignArchiveSchema.parse(body)
      : undefined;
  const existing = await db.membershipCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new PromotionError("Kampanya bulunamadı.", 404);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipCampaign.update({
      where: { id: campaignId },
      data: { status: "ARCHIVED", archivedAt: new Date(), autoApply: false },
    });
    await logAdminCampaignAudit({
      userId: actorUserId,
      action: "CAMPAIGN_ARCHIVED",
      campaignId,
      displayMessage: parsed?.reason ?? `Kampanya arşivlendi: ${row.name}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminCampaignCaches(campaignId);
  return updated;
}
