import "server-only";

import type { MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { MembershipServiceError } from "@/lib/membership-service";
import { getActiveAddOnPrice } from "@/lib/admin/addons/addon-price-service";
import { calculateVatBreakdown } from "@/lib/billing/pricing-utils";
import { normalizeCurrency } from "@/lib/payments/money";
import { generatePaytrMerchantOid } from "@/lib/payments/merchant-oid";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import { getPaytrConfig } from "@/lib/payments/providers/paytr/paytr-config";
import { resolveCompanyEntitlements } from "@/lib/billing/entitlements/entitlement-resolution-service";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { nextBillingDate, resolvePaidPeriod } from "@/lib/billing/billing-period-utils";

export async function listPurchasableAddOns(companyId: string) {
  const [addOns, entitlements, activeSubs] = await Promise.all([
    db.membershipAddOn.findMany({
      where: { status: "ACTIVE", isPublic: true },
      include: {
        prices: { where: { status: "ACTIVE" }, orderBy: { version: "desc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    resolveCompanyEntitlements(companyId),
    db.companyAddOnSubscription.findMany({
      where: {
        companyId,
        status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END", "PENDING"] },
      },
      include: { addOn: true },
    }),
  ]);

  return addOns
    .filter((addOn) => {
      if (addOn.prerequisiteCodes.length === 0) return true;
      return addOn.prerequisiteCodes.every((code) => {
        const ent = entitlements.entitlements[code];
        return ent?.kind === "FEATURE" && ent.enabled;
      });
    })
    .map((addOn) => ({
      id: addOn.id,
      code: addOn.code,
      name: addOn.name,
      description: addOn.description,
      type: addOn.type,
      entitlementCode: addOn.entitlementCode,
      entitlementQuantity: addOn.entitlementQuantity,
      recurringAllowed: addOn.recurringAllowed,
      prices: addOn.prices.map((p) => ({
        id: p.id,
        billingInterval: p.billingInterval,
        salePriceMinor: p.salePriceMinor,
        listPriceMinor: p.listPriceMinor,
        currency: p.currency,
        vatRate: p.vatRate,
        vatIncluded: p.vatIncluded,
      })),
      activeSubscription: activeSubs.find((s) => s.addOnId === addOn.id) ?? null,
    }));
}

async function resolveAddOnCheckout(input: {
  companyId: string;
  addOnId: string;
  quantity: number;
  billingInterval?: MembershipPeriod | null;
}) {
  const addOn = await db.membershipAddOn.findFirst({
    where: { id: input.addOnId, status: "ACTIVE", isPublic: true },
  });
  if (!addOn) throw new MembershipServiceError("Ek paket bulunamadı veya aktif değil.", 404);

  if (input.quantity <= 0 || input.quantity > 100) {
    throw new MembershipServiceError("Geçersiz miktar.", 400);
  }

  const entitlements = await resolveCompanyEntitlements(input.companyId);
  for (const code of addOn.prerequisiteCodes) {
    const ent = entitlements.entitlements[code];
    if (!ent || ent.kind !== "FEATURE" || !ent.enabled) {
      throw new MembershipServiceError("Bu ek paket için ön koşul özellikler aktif değil.", 400);
    }
  }

  const price = await getActiveAddOnPrice({
    addOnId: addOn.id,
    billingInterval: addOn.type === "RECURRING" ? input.billingInterval : null,
  });
  if (!price) throw new MembershipServiceError("Aktif fiyat bulunamadı.", 400);

  const lineMinor = price.salePriceMinor * input.quantity;
  const vat = calculateVatBreakdown({
    salePriceMinor: lineMinor,
    vatRate: price.vatRate,
    vatIncluded: price.vatIncluded,
  });
  const totals = {
    subtotalMinor: vat.subtotalMinor,
    vatMinor: vat.vatMinor,
    totalMinor: vat.totalMinor,
    currency: price.currency,
  };

  return { addOn, price, totals };
}

export async function initializeAddOnPurchase(input: {
  companyId: string;
  userId: string;
  addOnId: string;
  quantity: number;
  billingInterval?: MembershipPeriod | null;
  autoRenew?: boolean;
  saveCard?: boolean;
  idempotencyKey: string;
  payerIp: string;
}) {
  if (input.autoRenew && !input.saveCard) {
    throw new MembershipServiceError("Otomatik yenileme için kart saklama onayı gereklidir.", 400);
  }

  const config = getPaytrConfig();
  if (!config.directApiEnabled) {
    throw new MembershipServiceError("PayTR ödeme şu an kullanılamıyor.", 503);
  }

  const [company, subscription, checkout] = await Promise.all([
    db.company.findUnique({
      where: { id: input.companyId },
      include: { users: { take: 1, include: { user: true } } },
    }),
    db.companySubscription.findUnique({ where: { companyId: input.companyId } }),
    resolveAddOnCheckout({
      companyId: input.companyId,
      addOnId: input.addOnId,
      quantity: input.quantity,
      billingInterval: input.billingInterval,
    }),
  ]);

  if (!company) throw new MembershipServiceError("Firma bulunamadı.", 404);

  const pending = await db.membershipPayment.findFirst({
    where: {
      companyId: input.companyId,
      status: { in: ["CREATED", "FORM_READY", "PENDING", "WAIT_CALLBACK", "UNKNOWN"] },
      provider: { not: "TRIAL" },
    },
  });
  if (pending) {
    throw new MembershipServiceError("Devam eden bir ödeme işlemi var.", 409);
  }

  const { addOn, price, totals } = checkout;
  const paymentType =
    addOn.type === "USAGE_PACK"
      ? "USAGE_PACK_PURCHASE"
      : addOn.type === "RECURRING"
        ? "ADD_ON_PURCHASE"
        : "ADD_ON_PURCHASE";

  let periodStart = new Date();
  let periodEnd = new Date();
  if (addOn.type === "RECURRING" && input.billingInterval) {
    const period = resolvePaidPeriod({
      currentPeriodEnd: subscription?.currentPeriodEnd,
      trialEndsAt: subscription?.trialEndsAt,
      period: input.billingInterval,
    });
    periodStart = period.periodStart;
    periodEnd = period.periodEnd;
  }

  const merchantOid = generatePaytrMerchantOid();
  const payerEmail = company.email ?? company.users[0]?.user.email ?? "billing@hesapisleri.com";

  let addOnSub;
  if (addOn.type === "RECURRING") {
    const existing = await db.companyAddOnSubscription.findFirst({
      where: {
        companyId: input.companyId,
        addOnId: addOn.id,
        billingInterval: input.billingInterval ?? null,
        status: { in: ["ACTIVE", "PENDING", "CANCEL_AT_PERIOD_END"] },
      },
    });
    addOnSub = existing
      ? await db.companyAddOnSubscription.update({
          where: { id: existing.id },
          data: {
            addOnPriceId: price.id,
            quantity: input.quantity,
            status: "PENDING",
            autoRenew: input.autoRenew ?? false,
            priceSnapshot: price as unknown as Prisma.InputJsonValue,
          },
        })
      : await db.companyAddOnSubscription.create({
          data: {
            companyId: input.companyId,
            subscriptionId: subscription?.id,
            addOnId: addOn.id,
            addOnPriceId: price.id,
            quantity: input.quantity,
            status: "PENDING",
            billingInterval: input.billingInterval ?? null,
            autoRenew: input.autoRenew ?? false,
            priceSnapshot: price as unknown as Prisma.InputJsonValue,
          },
        });
  } else {
    addOnSub = await db.companyAddOnSubscription.create({
      data: {
        companyId: input.companyId,
        subscriptionId: subscription?.id,
        addOnId: addOn.id,
        addOnPriceId: price.id,
        quantity: input.quantity,
        status: "PENDING",
        billingInterval: input.billingInterval ?? null,
        autoRenew: false,
        priceSnapshot: price as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const payment = await db.membershipPayment.create({
    data: {
      companyId: input.companyId,
      subscriptionId: subscription?.id,
      periodStart,
      periodEnd,
      amount: totals.totalMinor / 100,
      currency: normalizeCurrency(totals.currency),
      status: "CREATED",
      paymentMethod: "PAYTR",
      type: paymentType,
      providerEnum: "PAYTR",
      provider: "PayTR",
      merchantOid,
      idempotencyKey: input.idempotencyKey,
      amountMinor: totals.totalMinor,
      subtotalMinor: totals.subtotalMinor,
      vatMinor: totals.vatMinor,
      discountMinor: 0,
      planNameSnapshot: addOn.name,
      billingPeriodSnapshot: input.billingInterval ?? addOn.type,
      priceSnapshot: {
        addOnId: addOn.id,
        addOnPriceId: price.id,
        addOnSubscriptionId: addOnSub.id,
        quantity: input.quantity,
        type: addOn.type,
      } as Prisma.InputJsonValue,
      payerEmail,
      payerName: company.name,
      payerPhone: company.phone ?? "0000000000",
      payerIp: input.payerIp,
      testMode: config.testMode,
      initiatedByUserId: input.userId,
      initiatedAt: new Date(),
      metadata: {
        addOnId: addOn.id,
        addOnSubscriptionId: addOnSub.id,
        quantity: input.quantity,
        autoRenew: input.autoRenew ?? false,
        saveCard: input.saveCard ?? false,
      },
    },
  });

  const adapter = createPaytrAdapter();
  const payload = await adapter.createInitialPayment({
    merchantOid,
    amountMinor: totals.totalMinor,
    currency: totals.currency,
    payerEmail,
    payerName: company.name,
    payerPhone: company.phone ?? "0000000000",
    payerIp: input.payerIp,
    okUrl: `${config.okUrl}?paymentId=${payment.id}`,
    failUrl: `${config.failUrl}?paymentId=${payment.id}`,
    basket: [{ name: addOn.name, amountMinor: totals.totalMinor, quantity: 1 }],
    saveCard: input.saveCard ?? false,
    testMode: config.testMode,
  });

  await db.membershipPayment.update({
    where: { id: payment.id },
    data: { status: "FORM_READY", providerAcceptedAt: new Date() },
  });

  return { ...payload, paymentId: payment.id };
}

export async function activateAddOnAfterPayment(
  payment: {
    id: string;
    companyId: string;
    periodStart: Date;
    periodEnd: Date;
    metadata: unknown;
    priceSnapshot: unknown;
  },
  tx: Prisma.TransactionClient
) {
  const meta = payment.metadata as {
    addOnSubscriptionId?: string;
    addOnId?: string;
    quantity?: number;
    autoRenew?: boolean;
  } | null;
  const snapshot = payment.priceSnapshot as { type?: string; quantity?: number } | null;

  if (!meta?.addOnSubscriptionId) return null;

  const addOnSub = await tx.companyAddOnSubscription.findUnique({
    where: { id: meta.addOnSubscriptionId },
    include: { addOn: true },
  });
  if (!addOnSub) return null;

  const now = new Date();
  const activated = await tx.companyAddOnSubscription.update({
    where: { id: addOnSub.id },
    data: {
      status: "ACTIVE",
      currentPeriodStart: payment.periodStart,
      currentPeriodEnd: payment.periodEnd,
      nextBillingAt:
        addOnSub.addOn.type === "RECURRING"
          ? nextBillingDate(payment.periodEnd, meta.autoRenew ?? false)
          : null,
      entitlementSnapshot: {
        code: addOnSub.addOn.entitlementCode,
        quantity: addOnSub.addOn.entitlementQuantity * (meta.quantity ?? addOnSub.quantity),
      },
    },
  });

  if (addOnSub.addOn.type === "USAGE_PACK") {
    const granted = addOnSub.addOn.entitlementQuantity * (snapshot?.quantity ?? addOnSub.quantity);
    const expiresAt = addOnSub.addOn.expiresAfterDays
      ? new Date(now.getTime() + addOnSub.addOn.expiresAfterDays * 86_400_000)
      : null;

    await tx.companyUsageCredit.create({
      data: {
        companyId: payment.companyId,
        entitlementCode: addOnSub.addOn.entitlementCode,
        sourceType: "ADDON_PURCHASE",
        sourceId: payment.id,
        granted,
        remaining: granted,
        expiresAt,
        status: "ACTIVE",
      },
    });
  }

  await tx.activityLog.create({
    data: {
      companyId: payment.companyId,
      action: "ADDON_PURCHASED",
      module: "billing-addons",
      message: JSON.stringify({
        paymentId: payment.id,
        addOnSubscriptionId: addOnSub.id,
        addOnId: addOnSub.addOnId,
      }),
    },
  });

  await enqueueBillingOutboxEvent(
    {
      companyId: payment.companyId,
      type: "ADDON_PURCHASED",
      aggregateType: "CompanyAddOnSubscription",
      aggregateId: addOnSub.id,
      payload: { paymentId: payment.id, addOnId: addOnSub.addOnId },
    },
    tx
  );

  invalidateCompanyEntitlementCache(payment.companyId);
  return activated;
}

export async function cancelAddOnSubscription(input: {
  companyId: string;
  addOnSubscriptionId: string;
  atPeriodEnd?: boolean;
}) {
  const sub = await db.companyAddOnSubscription.findFirst({
    where: { id: input.addOnSubscriptionId, companyId: input.companyId },
  });
  if (!sub) throw new MembershipServiceError("Ek paket aboneliği bulunamadı.", 404);

  const updated = await db.companyAddOnSubscription.update({
    where: { id: sub.id },
    data: input.atPeriodEnd
      ? { cancelAtPeriodEnd: true, status: "CANCEL_AT_PERIOD_END" }
      : { status: "CANCELLED", cancelledAt: new Date(), autoRenew: false },
  });

  invalidateCompanyEntitlementCache(input.companyId);
  await enqueueBillingOutboxEvent({
    companyId: input.companyId,
    type: input.atPeriodEnd ? "ADDON_CANCEL_SCHEDULED" : "ADDON_CANCELLED",
    aggregateType: "CompanyAddOnSubscription",
    aggregateId: sub.id,
    payload: { addOnSubscriptionId: sub.id },
  });

  return updated;
}
