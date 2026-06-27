import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";
import { getActiveAddOnPrice } from "@/lib/admin/addons/addon-price-service";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import { calculateVatBreakdown } from "@/lib/billing/pricing-utils";
import { findAddOnPriceResolutionConflicts } from "@/lib/admin/addons/admin-addon-price-resolution-utils";

export async function previewAddOnPrice(
  addOnId: string,
  input: {
    quantity: number;
    billingInterval?: MembershipPeriod | null;
    currency?: string;
  }
) {
  const addOn = await db.membershipAddOn.findUnique({
    where: { id: addOnId },
    include: { prices: true },
  });
  if (!addOn) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  const currency = input.currency ?? addOn.currency;
  const ineligibleReasons: string[] = [];
  const now = new Date();

  if (addOn.status === "ARCHIVED") ineligibleReasons.push("Add-on arşivlenmiş.");
  if (addOn.status === "DRAFT") ineligibleReasons.push("Add-on henüz aktif değil.");
  if (!addOn.isPublic) ineligibleReasons.push("Add-on herkese açık değil.");
  if (input.quantity <= 0 || input.quantity > 100) {
    ineligibleReasons.push("Geçersiz miktar.");
  }
  if (addOn.type === "RECURRING" && !input.billingInterval) {
    ineligibleReasons.push("Yinelenen paket için dönem zorunludur.");
  }
  if (currency !== addOn.currency) {
    ineligibleReasons.push(
      `İstenen para birimi (${currency}) add-on para birimi (${addOn.currency}) ile uyumsuz.`
    );
  }

  const conflicts = findAddOnPriceResolutionConflicts(addOn.prices, now);
  if (conflicts.length) {
    ineligibleReasons.push("Birden fazla efektif fiyat çakışması var.");
  }

  const price = await getActiveAddOnPrice({
    addOnId,
    billingInterval: input.billingInterval ?? null,
    currency,
    at: now,
  });

  if (!price && addOn.status === "ACTIVE") {
    ineligibleReasons.push("Geçerli fiyat bulunamadı.");
  }

  const unitSaleMinor = price?.salePriceMinor ?? 0;
  const unitListMinor = price?.listPriceMinor ?? 0;
  const lineSaleMinor = unitSaleMinor * input.quantity;
  const lineListMinor = unitListMinor * input.quantity;

  const vat = calculateVatBreakdown({
    salePriceMinor: lineSaleMinor,
    vatRate: price?.vatRate ?? addOn.vatRate,
    vatIncluded: price?.vatIncluded ?? addOn.vatIncluded,
  });

  const meta = getEntitlementMeta(addOn.entitlementCode);
  const resolvedContribution =
    meta?.kind === "LIMIT"
      ? addOn.entitlementQuantity * input.quantity
      : meta?.kind === "FEATURE"
        ? true
        : null;

  return {
    eligible: ineligibleReasons.length === 0,
    ineligibleReasons,
    addOn: {
      id: addOn.id,
      code: addOn.code,
      name: addOn.name,
      type: addOn.type,
      currency: addOn.currency,
      status: addOn.status,
    },
    quantity: input.quantity,
    billingInterval: input.billingInterval ?? null,
    currency,
    price: price
      ? {
          id: price.id,
          version: price.version,
          listPriceMinor: price.listPriceMinor,
          salePriceMinor: price.salePriceMinor,
          vatRate: price.vatRate,
          vatIncluded: price.vatIncluded,
          effectiveFrom: price.effectiveFrom.toISOString(),
          effectiveUntil: price.effectiveUntil?.toISOString() ?? null,
        }
      : null,
    unitListMinor,
    unitSaleMinor,
    lineListMinor,
    lineSaleMinor,
    totalMinor: vat.totalMinor,
    vatMinor: vat.vatMinor,
    entitlement: {
      code: addOn.entitlementCode,
      label: meta?.label ?? addOn.entitlementCode,
      kind: meta?.kind ?? null,
      valueType: meta?.valueType ?? null,
      quantityPerUnit: addOn.entitlementQuantity,
      resolvedContribution,
      multipliedByQuantity: meta?.kind === "LIMIT",
      enforcement: meta?.blockingBehavior ?? "NONE",
    },
    stackingNote:
      "Add-on fiyatı ana plan checkout'unda ayrı satır olarak hesaplanır; kampanya/kupon yalnızca plan fiyatına uygulanır.",
  };
}
