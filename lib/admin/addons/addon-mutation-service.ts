import "server-only";

import type { MembershipAddOnType, MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { isKnownEntitlementCode } from "@/lib/billing/entitlements/entitlement-registry";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";
import {
  adminAddonActivateSchema,
  adminAddonArchiveSchema,
  adminAddonCreateSchema,
  adminAddonUpdateSchema,
  assertAddonTypeEditAllowed,
  assertNoForbiddenAddonCreateKeys,
  assertNoForbiddenAddonPatchKeys,
} from "@/lib/admin/addons/admin-addon-schemas";
import { logAdminAddOnAudit } from "@/lib/admin/addons/admin-addon-audit-service";
import { invalidateAdminAddOnCaches } from "@/lib/admin/addons/admin-addon-cache";
import { assertAddOnActivationAllowed } from "@/lib/admin/addons/admin-addon-issue-service";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createAddOn(actorUserId: string, input: Record<string, unknown>) {
  assertNoForbiddenAddonCreateKeys(input);
  const parsed = adminAddonCreateSchema.parse(input);

  if (!isKnownEntitlementCode(parsed.entitlementCode)) {
    throw new AddOnServiceError("Geçersiz entitlement kodu.", 400);
  }

  const slug = parsed.slug?.trim() || slugify(parsed.name);
  const code = parsed.code.trim().toUpperCase();

  const existing = await db.membershipAddOn.findFirst({
    where: { OR: [{ code }, { slug }] },
  });
  if (existing) throw new AddOnServiceError("Kod veya slug zaten kullanılıyor.", 409);

  const addOn = await db.$transaction(async (tx) => {
    const row = await tx.membershipAddOn.create({
      data: {
        name: parsed.name.trim(),
        code,
        slug,
        description: parsed.description?.trim(),
        type: parsed.type,
        status: "DRAFT",
        entitlementCode: parsed.entitlementCode,
        entitlementQuantity: parsed.entitlementQuantity,
        currency: parsed.currency,
        vatRate: parsed.vatRate ?? 20,
        vatIncluded: parsed.vatIncluded ?? false,
        isPublic: parsed.isPublic ?? true,
        isFeatured: parsed.isFeatured ?? false,
        sortOrder: parsed.sortOrder ?? 100,
        recurringAllowed: parsed.recurringAllowed ?? parsed.type === "RECURRING",
        prorationAllowed: parsed.prorationAllowed ?? false,
        carryOver: parsed.carryOver ?? false,
        expiresAfterDays: parsed.expiresAfterDays ?? null,
        prerequisiteCodes: parsed.prerequisiteCodes ?? [],
      },
    });

    if (parsed.initialPrice) {
      await tx.membershipAddOnPrice.create({
        data: {
          addOnId: row.id,
          billingInterval: parsed.initialPrice.billingInterval ?? null,
          version: 1,
          listPriceMinor: parsed.initialPrice.listPriceMinor,
          salePriceMinor: parsed.initialPrice.salePriceMinor,
          currency: parsed.initialPrice.currency ?? parsed.currency,
          vatRate: parsed.initialPrice.vatRate ?? parsed.vatRate ?? 20,
          vatIncluded: parsed.initialPrice.vatIncluded ?? parsed.vatIncluded ?? false,
          effectiveFrom: parsed.initialPrice.effectiveFrom
            ? new Date(parsed.initialPrice.effectiveFrom)
            : new Date(),
          status: "DRAFT",
        },
      });
    }

    await logAdminAddOnAudit({
      userId: actorUserId,
      action: "ADDON_CREATED",
      addOnId: row.id,
      displayMessage: `Add-on oluşturuldu: ${row.code}`,
      metadata: { reason: parsed.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminAddOnCaches(addOn.id);
  return addOn;
}

export async function updateAddOn(
  id: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  assertNoForbiddenAddonPatchKeys(input);
  const parsed = adminAddonUpdateSchema.parse(input);

  const before = await db.membershipAddOn.findUnique({ where: { id } });
  if (!before) throw new AddOnServiceError("Ek paket bulunamadı.", 404);
  if (before.status === "ARCHIVED") {
    throw new AddOnServiceError("Arşivlenmiş add-on güncellenemez.");
  }

  assertAddonTypeEditAllowed(before.status === "DRAFT", input);
  if (parsed.type !== undefined && before.status !== "DRAFT") {
    throw new AddOnServiceError("Tür yalnızca taslak add-on için değiştirilebilir.", 400);
  }

  if (parsed.entitlementCode && !isKnownEntitlementCode(parsed.entitlementCode)) {
    throw new AddOnServiceError("Geçersiz entitlement kodu.", 400);
  }

  const entitlementChanged =
    (parsed.entitlementCode !== undefined && parsed.entitlementCode !== before.entitlementCode) ||
    (parsed.entitlementQuantity !== undefined &&
      parsed.entitlementQuantity !== before.entitlementQuantity);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipAddOn.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description?.trim() } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.type === "RECURRING" ? { recurringAllowed: true } : {}),
        ...(parsed.entitlementCode !== undefined
          ? { entitlementCode: parsed.entitlementCode }
          : {}),
        ...(parsed.entitlementQuantity !== undefined
          ? { entitlementQuantity: parsed.entitlementQuantity }
          : {}),
        ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
        ...(parsed.vatRate !== undefined ? { vatRate: parsed.vatRate } : {}),
        ...(parsed.vatIncluded !== undefined ? { vatIncluded: parsed.vatIncluded } : {}),
        ...(parsed.isPublic !== undefined ? { isPublic: parsed.isPublic } : {}),
        ...(parsed.isFeatured !== undefined ? { isFeatured: parsed.isFeatured } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.recurringAllowed !== undefined
          ? { recurringAllowed: parsed.recurringAllowed }
          : {}),
        ...(parsed.prorationAllowed !== undefined
          ? { prorationAllowed: parsed.prorationAllowed }
          : {}),
        ...(parsed.carryOver !== undefined ? { carryOver: parsed.carryOver } : {}),
        ...(parsed.expiresAfterDays !== undefined
          ? { expiresAfterDays: parsed.expiresAfterDays }
          : {}),
        ...(parsed.prerequisiteCodes !== undefined
          ? { prerequisiteCodes: parsed.prerequisiteCodes }
          : {}),
      },
    });

    await logAdminAddOnAudit({
      userId: actorUserId,
      action: entitlementChanged ? "ADDON_ENTITLEMENTS_UPDATED" : "ADDON_UPDATED",
      addOnId: id,
      displayMessage: entitlementChanged
        ? `Add-on entitlement güncellendi: ${row.code}`
        : `Add-on güncellendi: ${row.code}`,
      metadata: { reason: parsed.reason ?? null, fields: Object.keys(parsed) },
      tx,
    });

    return row;
  });

  invalidateAdminAddOnCaches(id);
  return updated;
}

export async function activateAddOn(
  id: string,
  actorUserId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminAddonActivateSchema.parse(body) : undefined;

  const addOn = await db.membershipAddOn.findUnique({
    where: { id },
    include: {
      prices: true,
      _count: {
        select: {
          subscriptions: {
            where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
          },
        },
      },
    },
  });
  if (!addOn) throw new AddOnServiceError("Ek paket bulunamadı.", 404);
  if (addOn.status === "ARCHIVED") {
    throw new AddOnServiceError("Arşivlenmiş add-on aktifleştirilemez.");
  }

  const now = new Date();
  const hasEffectivePrice = addOn.prices.some((p) => {
    if (p.status !== "ACTIVE") return false;
    if (p.effectiveFrom > now) return false;
    if (p.effectiveUntil && p.effectiveUntil <= now) return false;
    return true;
  });
  const hasFreePolicy = addOn.prices.some(
    (p) => p.status === "ACTIVE" && p.salePriceMinor === 0 && p.effectiveFrom <= now
  );
  if (!hasEffectivePrice && !hasFreePolicy) {
    throw new AddOnServiceError(
      "Aktivasyon için yayınlanmış geçerli fiyat veya ücretsiz politika gerekli.",
      400
    );
  }

  await assertAddOnActivationAllowed({
    id: addOn.id,
    status: addOn.status,
    type: addOn.type,
    currency: addOn.currency,
    entitlementCode: addOn.entitlementCode,
    entitlementQuantity: addOn.entitlementQuantity,
    prices: addOn.prices,
    activeSubscriptionCount: addOn._count.subscriptions,
  });

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipAddOn.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    await logAdminAddOnAudit({
      userId: actorUserId,
      action: "ADDON_ACTIVATED",
      addOnId: id,
      displayMessage: `Add-on aktifleştirildi: ${row.code}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminAddOnCaches(id);
  return updated;
}

export async function archiveAddOn(
  id: string,
  actorUserId: string,
  body?: Record<string, unknown>
) {
  const parsed =
    body && Object.keys(body).length > 0 ? adminAddonArchiveSchema.parse(body) : undefined;

  const existing = await db.membershipAddOn.findUnique({ where: { id } });
  if (!existing) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipAddOn.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await logAdminAddOnAudit({
      userId: actorUserId,
      action: "ADDON_ARCHIVED",
      addOnId: id,
      displayMessage: parsed?.reason ?? `Add-on arşivlendi: ${row.code}`,
      metadata: { reason: parsed?.reason ?? null },
      tx,
    });
    return row;
  });

  invalidateAdminAddOnCaches(id);
  return updated;
}

export async function duplicateAddOn(id: string, actorUserId: string) {
  const source = await db.membershipAddOn.findUnique({
    where: { id },
    include: { prices: { where: { status: "ACTIVE" }, orderBy: { version: "desc" }, take: 1 } },
  });
  if (!source) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return createAddOn(actorUserId, {
    name: `${source.name} (Kopya)`,
    code: `${source.code}_${suffix}`,
    slug: `${source.slug}-${suffix.toLowerCase()}`,
    description: source.description,
    type: source.type,
    entitlementCode: source.entitlementCode,
    entitlementQuantity: source.entitlementQuantity,
    currency: source.currency,
    vatRate: source.vatRate,
    vatIncluded: source.vatIncluded,
    isPublic: source.isPublic,
    isFeatured: false,
    sortOrder: source.sortOrder,
    recurringAllowed: source.recurringAllowed,
    prorationAllowed: source.prorationAllowed,
    carryOver: source.carryOver,
    expiresAfterDays: source.expiresAfterDays,
    prerequisiteCodes: source.prerequisiteCodes,
    initialPrice: source.prices[0]
      ? {
          billingInterval: source.prices[0].billingInterval,
          listPriceMinor: source.prices[0].listPriceMinor,
          salePriceMinor: source.prices[0].salePriceMinor,
          currency: source.prices[0].currency,
          vatRate: source.prices[0].vatRate,
          vatIncluded: source.prices[0].vatIncluded,
        }
      : undefined,
  });
}
