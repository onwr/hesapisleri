import "server-only";

import type { MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  assertValidEntitlementSet,
  normalizeEntitlementRow,
  type EntitlementInputRow,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import { buildPriceTotals } from "@/lib/billing/pricing-utils";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import {
  invalidateAdminPlanCaches,
  invalidateAdminPlanEntitlementCaches,
} from "@/lib/admin/plans/admin-plan-cache";
import {
  AdminPlanPatchValidationError,
  adminPlanCreateSchema,
  assertNoForbiddenPlanCreateKeys,
  normalizeAdminPlanCreateBody,
  type AdminPlanCreateInput,
  type AdminPlanPeriodPriceCreateInput,
} from "@/lib/admin/plans/admin-plan-schemas";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import {
  assertPlanCodeAvailable,
  normalizePlanCode,
} from "@/lib/admin/plans/admin-plan-code-utils";
import {
  getExistingCreatePlanId,
  recordCreatePlanIdempotency,
} from "@/lib/admin/plans/admin-plan-create-idempotency";
import { resolvePeriodPriceMinor } from "@/lib/admin/plans/admin-plan-period-pricing-utils";
import { syncLegacyPlanColumnIfApplicable } from "@/lib/admin/plans/admin-plan-price-publish-service";

export class AdminPlanCreateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPlanCreateError";
    this.status = status;
  }
}

async function upsertEntitlementsInTx(
  tx: Prisma.TransactionClient,
  planId: string,
  rows: EntitlementInputRow[]
) {
  const normalized = rows.map(normalizeEntitlementRow);
  const saved = [];
  for (const row of normalized) {
    const item = await tx.planEntitlement.create({
      data: {
        planId,
        code: row.code,
        valueType: row.valueType,
        booleanValue: row.booleanValue,
        numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
        stringValue: row.stringValue,
        isUnlimited: row.isUnlimited ?? false,
        description: row.description ?? null,
        category: row.category ?? getEntitlementMeta(row.code)?.category ?? null,
        sortOrder: row.sortOrder ?? 100,
      },
    });
    saved.push(item);
  }
  return saved;
}

async function createPlanPriceInTx(
  tx: Prisma.TransactionClient,
  input: {
    planId: string;
    actorUserId: string;
    currency: string;
    vatRate: number;
    vatIncluded: boolean;
    salesOpen: boolean;
    monthlyPriceMinor: number;
    periodPrice: AdminPlanPeriodPriceCreateInput;
    now: Date;
  }
) {
  const resolved = resolvePeriodPriceMinor({
    monthlyPriceMinor: input.monthlyPriceMinor,
    interval: input.periodPrice.billingInterval,
    enabled: input.periodPrice.enabled,
    discountPercent: input.periodPrice.discountPercent,
    salePriceMinor: input.periodPrice.salePriceMinor,
  });
  if (!resolved) return null;

  const totals = buildPriceTotals({
    listPriceMinor: resolved.listPriceMinor,
    salePriceMinor: resolved.salePriceMinor,
    interval: input.periodPrice.billingInterval,
    vatRate: input.vatRate,
    vatIncluded: input.vatIncluded,
    discountPercent: resolved.discountPercent,
  });

  const price = await tx.membershipPlanPrice.create({
    data: {
      planId: input.planId,
      billingInterval: input.periodPrice.billingInterval,
      version: 1,
      status: "ACTIVE",
      listPriceMinor: totals.listPriceMinor,
      salePriceMinor: totals.salePriceMinor,
      currency: input.currency,
      vatRate: input.vatRate,
      vatIncluded: input.vatIncluded,
      monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
      effectiveFrom: input.now,
      effectiveUntil: null,
      isAutoRenewEnabled: true,
      isPublic: input.salesOpen,
      priceChangePolicy: "NEW_SUBSCRIBERS_ONLY",
      adminNote: "Plan oluşturma",
      createdByUserId: input.actorUserId,
      publishedByUserId: input.actorUserId,
      publishedAt: input.now,
    },
  });

  await syncLegacyPlanColumnIfApplicable(
    tx,
    { id: input.planId, defaultCurrency: input.currency, currency: input.currency },
    input.periodPrice.billingInterval as MembershipPeriod,
    totals.salePriceMinor,
    input.currency
  );

  return price;
}

function resolvePlanLifecycle(input: AdminPlanCreateInput, hasEnabledPrices: boolean) {
  const salesReady = input.salesOpen && hasEnabledPrices;
  return {
    planStatus: salesReady ? ("ACTIVE" as const) : ("DRAFT" as const),
    visibility: salesReady ? ("PUBLIC" as const) : ("PRIVATE" as const),
    isActive: salesReady,
    publishedAt: salesReady ? new Date() : null,
  };
}

export async function createAdminPlanDraft(rawBody: unknown, actorUserId: string) {
  const body = normalizeAdminPlanCreateBody(rawBody);
  if (!Object.keys(body).length) {
    throw new AdminPlanCreateError("Geçersiz istek gövdesi.");
  }
  assertNoForbiddenPlanCreateKeys(body);

  const parsed = adminPlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Plan bilgileri geçersiz.";
    throw new AdminPlanPatchValidationError(message);
  }

  const input: AdminPlanCreateInput = parsed.data;

  const existingId = getExistingCreatePlanId(input.clientRequestId);
  if (existingId) {
    const plan = await db.membershipPlan.findUnique({ where: { id: existingId } });
    if (plan) return plan;
  }

  const codeSource = input.code?.trim() || normalizePlanCode(input.name);
  const code = await assertPlanCodeAvailable(codeSource);
  const normalizedEntitlements = input.entitlements.map(normalizeEntitlementRow);
  assertValidEntitlementSet(normalizedEntitlements);

  const monthlyRow = input.periodPrices.find((p) => p.billingInterval === "MONTHLY");
  const monthlyPriceMinor = monthlyRow?.salePriceMinor;
  if (!monthlyPriceMinor || monthlyPriceMinor <= 0) {
    throw new AdminPlanCreateError("Aylık fiyat zorunludur.");
  }

  const enabledPeriods = input.periodPrices.filter((p) => p.enabled);
  const lifecycle = resolvePlanLifecycle(input, enabledPeriods.length > 0);
  const now = new Date();

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.membershipPlan.create({
      data: {
        name: input.name,
        code,
        slug: code,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        planStatus: lifecycle.planStatus,
        visibility: lifecycle.visibility,
        isFeatured: input.isFeatured,
        sortOrder: input.sortOrder,
        trialEnabled: input.trialEnabled,
        trialDays: input.trialDays,
        defaultCurrency: input.currency,
        currency: input.currency,
        vatRate: 20,
        vatIncluded: false,
        monthlyPrice: monthlyPriceMinor / 100,
        quarterlyPrice: 0,
        semiAnnualPrice: 0,
        yearlyPrice: 0,
        isActive: lifecycle.isActive,
        features: [],
        publishedAt: lifecycle.publishedAt,
        archivedAt: null,
      },
    });

    const createdPrices = [];
    for (const periodPrice of input.periodPrices) {
      const price = await createPlanPriceInTx(tx, {
        planId: created.id,
        actorUserId,
        currency: input.currency,
        vatRate: 20,
        vatIncluded: false,
        salesOpen: lifecycle.isActive,
        monthlyPriceMinor,
        periodPrice,
        now,
      });
      if (price) createdPrices.push(price);
    }

    if (input.salesOpen && createdPrices.length === 0) {
      throw new AdminPlanCreateError("Satışa açık plan için fiyat oluşturulamadı.");
    }

    const savedEntitlements = await upsertEntitlementsInTx(tx, created.id, normalizedEntitlements);

    await tx.planEntitlementVersion.create({
      data: {
        planId: created.id,
        version: 1,
        status: "ACTIVE",
        changePolicy: "NEW_SUBSCRIBERS_ONLY",
        entitlementsJson: savedEntitlements,
        createdByUserId: actorUserId,
        publishedByUserId: actorUserId,
        publishedAt: now,
      },
    });

    await logAdminPlanAudit({
      userId: actorUserId,
      action: "PLAN_CREATED",
      planId: created.id,
      entityType: "MembershipPlan",
      entityId: created.id,
      displayMessage: lifecycle.isActive
        ? `Plan oluşturuldu ve satışa açıldı: ${created.name}`
        : `Plan pasif olarak oluşturuldu: ${created.name}`,
      metadata: {
        code: created.code,
        entitlementCount: savedEntitlements.length,
        priceCount: createdPrices.length,
        salesOpen: input.salesOpen,
        currency: input.currency,
      },
      tx,
    });

    return created;
  });

  recordCreatePlanIdempotency(input.clientRequestId, plan.id);
  invalidateAdminPlanCaches(plan.id);
  invalidateAdminPlanEntitlementCaches(plan.id);

  return plan;
}
