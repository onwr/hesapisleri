import "server-only";

import type { MembershipAddOnType, MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { isKnownEntitlementCode } from "@/lib/billing/entitlements/entitlement-registry";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createAddOn(input: {
  name: string;
  code: string;
  slug?: string;
  description?: string;
  type: MembershipAddOnType;
  status?: "DRAFT" | "ACTIVE";
  entitlementCode: string;
  entitlementQuantity: number;
  isPublic?: boolean;
  isFeatured?: boolean;
  recurringAllowed?: boolean;
  prorationAllowed?: boolean;
  carryOver?: boolean;
  expiresAfterDays?: number | null;
  prerequisiteCodes?: string[];
  actorUserId: string;
  initialPrice?: {
    billingInterval?: MembershipPeriod | null;
    listPriceMinor: number;
    salePriceMinor: number;
    vatRate?: number;
    vatIncluded?: boolean;
  };
}) {
  if (!isKnownEntitlementCode(input.entitlementCode)) {
    throw new AddOnServiceError("Geçersiz entitlement kodu.", 400);
  }
  if (input.entitlementQuantity <= 0) {
    throw new AddOnServiceError("Miktar pozitif olmalıdır.", 400);
  }
  if (input.type === "USAGE_PACK" && input.entitlementQuantity <= 0) {
    throw new AddOnServiceError("Kullanım paketi için miktar zorunludur.", 400);
  }

  const slug = input.slug?.trim() || slugify(input.name);
  const code = input.code.trim().toUpperCase();

  const existing = await db.membershipAddOn.findFirst({
    where: { OR: [{ code }, { slug }] },
  });
  if (existing) throw new AddOnServiceError("Kod veya slug zaten kullanılıyor.", 409);

  return db.$transaction(async (tx) => {
    const addOn = await tx.membershipAddOn.create({
      data: {
        name: input.name.trim(),
        code,
        slug,
        description: input.description?.trim(),
        type: input.type,
        status: input.status ?? "DRAFT",
        entitlementCode: input.entitlementCode,
        entitlementQuantity: input.entitlementQuantity,
        isPublic: input.isPublic ?? true,
        isFeatured: input.isFeatured ?? false,
        recurringAllowed: input.recurringAllowed ?? input.type === "RECURRING",
        prorationAllowed: input.prorationAllowed ?? false,
        carryOver: input.carryOver ?? false,
        expiresAfterDays: input.expiresAfterDays ?? null,
        prerequisiteCodes: input.prerequisiteCodes ?? [],
      },
    });

    if (input.initialPrice) {
      await tx.membershipAddOnPrice.create({
        data: {
          addOnId: addOn.id,
          billingInterval: input.initialPrice.billingInterval ?? null,
          version: 1,
          listPriceMinor: input.initialPrice.listPriceMinor,
          salePriceMinor: input.initialPrice.salePriceMinor,
          vatRate: input.initialPrice.vatRate ?? 20,
          vatIncluded: input.initialPrice.vatIncluded ?? false,
          status: "ACTIVE",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: input.actorUserId,
        action: "ADDON_CREATED",
        module: "admin-addons",
        message: JSON.stringify({ addOnId: addOn.id, code: addOn.code }),
      },
    });

    return addOn;
  });
}

export async function updateAddOn(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    isPublic: boolean;
    isFeatured: boolean;
    sortOrder: number;
    entitlementQuantity: number;
    prerequisiteCodes: string[];
    recurringAllowed: boolean;
    prorationAllowed: boolean;
    carryOver: boolean;
    expiresAfterDays: number | null;
  }> & { actorUserId: string }
) {
  const before = await db.membershipAddOn.findUnique({ where: { id } });
  if (!before) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  const updated = await db.membershipAddOn.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description?.trim(),
      status: input.status,
      isPublic: input.isPublic,
      isFeatured: input.isFeatured,
      sortOrder: input.sortOrder,
      entitlementQuantity: input.entitlementQuantity,
      prerequisiteCodes: input.prerequisiteCodes,
      recurringAllowed: input.recurringAllowed,
      prorationAllowed: input.prorationAllowed,
      carryOver: input.carryOver,
      expiresAfterDays: input.expiresAfterDays,
    },
  });

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      action: "ADDON_UPDATED",
      module: "admin-addons",
      message: JSON.stringify({ addOnId: id, before, after: updated }),
    },
  });

  return updated;
}

export async function archiveAddOn(id: string, actorUserId: string) {
  const addOn = await db.membershipAddOn.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  await db.activityLog.create({
    data: {
      userId: actorUserId,
      action: "ADDON_ARCHIVED",
      module: "admin-addons",
      message: JSON.stringify({ addOnId: id }),
    },
  });

  return addOn;
}

export async function duplicateAddOn(id: string, actorUserId: string) {
  const source = await db.membershipAddOn.findUnique({
    where: { id },
    include: { prices: { where: { status: "ACTIVE" } } },
  });
  if (!source) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return createAddOn({
    name: `${source.name} (Kopya)`,
    code: `${source.code}_${suffix}`,
    slug: `${source.slug}-${suffix.toLowerCase()}`,
    description: source.description ?? undefined,
    type: source.type,
    status: "DRAFT",
    entitlementCode: source.entitlementCode,
    entitlementQuantity: source.entitlementQuantity,
    isPublic: source.isPublic,
    isFeatured: false,
    recurringAllowed: source.recurringAllowed,
    prorationAllowed: source.prorationAllowed,
    carryOver: source.carryOver,
    expiresAfterDays: source.expiresAfterDays,
    prerequisiteCodes: source.prerequisiteCodes,
    actorUserId,
    initialPrice: source.prices[0]
      ? {
          billingInterval: source.prices[0].billingInterval,
          listPriceMinor: source.prices[0].listPriceMinor,
          salePriceMinor: source.prices[0].salePriceMinor,
          vatRate: source.prices[0].vatRate,
          vatIncluded: source.prices[0].vatIncluded,
        }
      : undefined,
  });
}
