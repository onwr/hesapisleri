import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts/admin-partner-payout-errors";
import { logAdminPartnerPayoutAudit } from "@/lib/admin/partner-payouts/admin-partner-payout-audit-service";
import { invalidateAdminPartnerPayoutCaches } from "@/lib/admin/partner-payouts/admin-partner-payout-cache";
import {
  assertValidPayoutStatusTransition,
  isPaymentProfileComplete,
  validateEarningsForCreate,
  validatePayoutMinimumThreshold,
} from "@/lib/admin/partner-payouts/admin-partner-payout-issue-service";
import { AdminPartnerSettingsServiceError } from "@/lib/admin/partner-settings/admin-partner-settings-errors";
import { loadPartnerSettingsForPayoutEnforcement } from "@/lib/admin/partner-settings/settings-query-service";
import {
  adminPartnerPayoutApproveSchema,
  adminPartnerPayoutCreateSchema,
  adminPartnerPayoutMarkPaidSchema,
  adminPartnerPayoutRejectSchema,
  assertNoForbiddenPayoutCreateKeys,
  assertNoForbiddenPayoutDecisionKeys,
} from "@/lib/admin/partner-payouts/admin-partner-payout-schemas";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function loadPayoutWithContext(payoutId: string, tx: Tx) {
  const payout = await tx.partnerPayout.findUnique({
    where: { id: payoutId },
    include: {
      partner: {
        select: {
          id: true,
          fullName: true,
          status: true,
          iban: true,
          payoutMethod: true,
          accountHolderName: true,
        },
      },
      earnings: true,
    },
  });
  if (!payout) {
    throw new AdminPartnerPayoutServiceError("Ödeme bulunamadı.", 404);
  }
  return payout;
}

function revalidateEarningsStillEligible(
  earnings: Array<{ status: string; payoutId: string | null; partnerId: string; amount: { toString(): string }; currency: string }>,
  payoutId: string,
  partnerId: string,
  payoutCurrency: string
) {
  for (const earning of earnings) {
    if (earning.partnerId !== partnerId) {
      throw new AdminPartnerPayoutServiceError("Hak ediş partner uyuşmazlığı.", 400, "PARTNER_MISMATCH");
    }
    if (earning.payoutId !== payoutId) {
      throw new AdminPartnerPayoutServiceError("Hak ediş bu ödemeye bağlı değil.", 400, "EARNING_ALREADY_ASSIGNED");
    }
    if (!["APPROVED", "PAYABLE"].includes(earning.status)) {
      throw new AdminPartnerPayoutServiceError("Hak ediş artık ödeme için uygun değil.", 400, "EARNING_STATUS_MISMATCH");
    }
    if (earning.currency !== payoutCurrency) {
      throw new AdminPartnerPayoutServiceError("Hak ediş para birimi uyuşmuyor.", 400, "CURRENCY_MISMATCH");
    }
  }
}

async function assertPaymentReferenceUnique(
  tx: Tx,
  paymentReference: string,
  partnerId: string,
  excludePayoutId?: string
) {
  const ref = paymentReference.trim();
  const globalDup = await tx.partnerPayout.findFirst({
    where: {
      paymentReference: ref,
      status: "PAID",
      ...(excludePayoutId ? { id: { not: excludePayoutId } } : {}),
    },
    select: { id: true },
  });
  if (globalDup) {
    throw new AdminPartnerPayoutServiceError(
      "Bu ödeme referansı başka bir ödemede kullanılıyor.",
      409,
      "DUPLICATE_PAYMENT_REFERENCE"
    );
  }

  const partnerDup = await tx.partnerPayout.findFirst({
    where: {
      partnerId,
      paymentReference: ref,
      ...(excludePayoutId ? { id: { not: excludePayoutId } } : {}),
    },
    select: { id: true },
  });
  if (partnerDup) {
    throw new AdminPartnerPayoutServiceError(
      "Bu partner için aynı ödeme referansı zaten kayıtlı.",
      409,
      "DUPLICATE_PAYMENT_REFERENCE"
    );
  }
}

export async function createPartnerPayoutAdmin(
  actorUserId: string,
  body: Record<string, unknown>,
  expectedPartnerId?: string
) {
  assertNoForbiddenPayoutCreateKeys(body);
  const parsed = adminPartnerPayoutCreateSchema.parse(body);

  const periodStart = parseOptionalDate(parsed.periodStart);
  const periodEnd = parsed.periodEnd ? endOfDay(parseOptionalDate(parsed.periodEnd)!) : undefined;
  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new AdminPartnerPayoutServiceError("Dönem başlangıcı bitişten sonra olamaz.", 400);
  }

  const uniqueIds = [...new Set(parsed.earningIds)];

  let minimumPayoutAmount: number;
  try {
    ({ minimumPayoutAmount } = await loadPartnerSettingsForPayoutEnforcement());
  } catch (error) {
    if (
      error instanceof AdminPartnerSettingsServiceError &&
      error.code === "SETTINGS_SINGLETON_CONFLICT"
    ) {
      throw new AdminPartnerPayoutServiceError(error.message, error.status, error.code);
    }
    throw error;
  }

  const result = await db.$transaction(async (tx) => {
    const earnings = await tx.partnerEarning.findMany({
      where: { id: { in: uniqueIds } },
    });

    if (earnings.length !== uniqueIds.length) {
      throw new AdminPartnerPayoutServiceError("Bazı hak edişler bulunamadı.", 404);
    }

    const validation = validateEarningsForCreate(earnings, {
      periodStart,
      periodEnd,
    });
    if (!validation.ok) {
      throw new AdminPartnerPayoutServiceError(
        validation.issues[0]!.message,
        400,
        validation.issues[0]!.code
      );
    }

    if (expectedPartnerId && validation.partnerId !== expectedPartnerId) {
      throw new AdminPartnerPayoutServiceError("Hak edişler bu partnere ait değil.", 400, "PARTNER_MISMATCH");
    }

    const partner = await tx.partnerProfile.findUnique({
      where: { id: validation.partnerId },
    });
    if (!partner) {
      throw new AdminPartnerPayoutServiceError("Partner bulunamadı.", 404);
    }
    if (partner.status === "ARCHIVED") {
      throw new AdminPartnerPayoutServiceError("Arşivlenmiş partner için ödeme oluşturulamaz.", 400, "ARCHIVED_PARTNER");
    }

    const thresholdCheck = validatePayoutMinimumThreshold(
      validation.total,
      validation.currency,
      minimumPayoutAmount
    );
    if (!thresholdCheck.ok) {
      throw new AdminPartnerPayoutServiceError(
        thresholdCheck.message,
        400,
        thresholdCheck.code
      );
    }

    const payout = await tx.partnerPayout.create({
      data: {
        partnerId: validation.partnerId,
        amount: validation.total,
        currency: validation.currency,
        status: "DRAFT",
        paymentMethod: parsed.paymentMethod,
        note: parsed.note?.trim() || null,
        createdByUserId: actorUserId,
      },
    });

    const linked = await tx.partnerEarning.updateMany({
      where: {
        id: { in: uniqueIds },
        partnerId: validation.partnerId,
        currency: validation.currency,
        payoutId: null,
        status: { in: ["APPROVED", "PAYABLE"] },
      },
      data: { payoutId: payout.id },
    });

    if (linked.count !== uniqueIds.length) {
      throw new AdminPartnerPayoutServiceError(
        "Bazı hak edişler artık uygun değil veya başka ödemeye atanmış.",
        409,
        "EARNING_ALREADY_ASSIGNED"
      );
    }

    await logAdminPartnerPayoutAudit({
      userId: actorUserId,
      action: "PARTNER_PAYOUT_CREATED",
      payoutId: payout.id,
      partnerId: validation.partnerId,
      displayMessage: `Partner ödemesi oluşturuldu: ${partner.fullName} · ${validation.total} ${validation.currency}`,
      metadata: {
        earningCount: uniqueIds.length,
        amount: validation.total,
        currency: validation.currency,
        reason: parsed.reason,
      },
      tx,
    });

    return payout;
  });

  invalidateAdminPartnerPayoutCaches(result.partnerId);

  return {
    id: result.id,
    partnerId: result.partnerId,
    amount: Number(result.amount),
    currency: result.currency,
    status: result.status,
    createdAt: result.createdAt.toISOString(),
  };
}

export async function approvePartnerPayoutAdmin(
  payoutId: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenPayoutDecisionKeys(body);
  const parsed = adminPartnerPayoutApproveSchema.parse(body);

  const result = await db.$transaction(async (tx) => {
    const payout = await loadPayoutWithContext(payoutId, tx);

    const transition = assertValidPayoutStatusTransition(payout.status, "PENDING");
    if (!transition.ok) {
      throw new AdminPartnerPayoutServiceError(transition.issues[0]!.message, 400, "INVALID_STATUS_TRANSITION");
    }

    revalidateEarningsStillEligible(
      payout.earnings,
      payoutId,
      payout.partnerId,
      payout.currency
    );

    const total = payout.earnings.reduce((sum, e) => sum + Number(e.amount), 0);
    if (Math.abs(total - Number(payout.amount)) > 0.009) {
      throw new AdminPartnerPayoutServiceError("Ödeme tutarı yeniden hesaplandı ve uyuşmuyor.", 400, "TOTAL_MISMATCH");
    }

    if (!isPaymentProfileComplete(payout.partner, payout.paymentMethod)) {
      throw new AdminPartnerPayoutServiceError(
        "Ödeme profili eksik; onay verilemez.",
        400,
        "PAYMENT_PROFILE_MISSING"
      );
    }

    if (payout.partner.status === "ARCHIVED") {
      throw new AdminPartnerPayoutServiceError("Arşivlenmiş partner ödemesi onaylanamaz.", 400, "ARCHIVED_PARTNER");
    }

    const updated = await tx.partnerPayout.update({
      where: { id: payoutId, status: "DRAFT" },
      data: { status: "PENDING" },
    });

    await logAdminPartnerPayoutAudit({
      userId: actorUserId,
      action: "PARTNER_PAYOUT_APPROVED",
      payoutId,
      partnerId: payout.partnerId,
      displayMessage: `Partner ödemesi onaylandı: ${payout.partner.fullName}`,
      metadata: { reason: parsed.reason, amount: total, currency: payout.currency },
      tx,
    });

    return updated;
  });

  invalidateAdminPartnerPayoutCaches(result.partnerId);
  return { id: result.id, status: result.status };
}

export async function rejectPartnerPayoutAdmin(
  payoutId: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenPayoutDecisionKeys(body);
  const parsed = adminPartnerPayoutRejectSchema.parse(body);

  const result = await db.$transaction(async (tx) => {
    const payout = await loadPayoutWithContext(payoutId, tx);

    const transition = assertValidPayoutStatusTransition(payout.status, "CANCELLED");
    if (!transition.ok) {
      throw new AdminPartnerPayoutServiceError(transition.issues[0]!.message, 400, "INVALID_STATUS_TRANSITION");
    }

    await tx.partnerEarning.updateMany({
      where: { payoutId },
      data: { payoutId: null },
    });

    const updated = await tx.partnerPayout.update({
      where: { id: payoutId },
      data: { status: "CANCELLED" },
    });

    await logAdminPartnerPayoutAudit({
      userId: actorUserId,
      action: "PARTNER_PAYOUT_REJECTED",
      payoutId,
      partnerId: payout.partnerId,
      displayMessage: `Partner ödemesi iptal edildi: ${payout.partner.fullName}`,
      metadata: { reason: parsed.reason },
      tx,
    });

    return updated;
  });

  invalidateAdminPartnerPayoutCaches(result.partnerId);
  return { id: result.id, status: result.status };
}

export async function markPartnerPayoutPaidAdmin(
  payoutId: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenPayoutDecisionKeys(body);
  const parsed = adminPartnerPayoutMarkPaidSchema.parse(body);
  const paymentReference = parsed.paymentReference.trim();

  const result = await db.$transaction(async (tx) => {
    const payout = await loadPayoutWithContext(payoutId, tx);

    if (payout.status === "PAID") {
      throw new AdminPartnerPayoutServiceError("Ödeme zaten ödenmiş olarak işaretli.", 409);
    }

    const transition = assertValidPayoutStatusTransition(payout.status, "PAID");
    if (!transition.ok) {
      throw new AdminPartnerPayoutServiceError(transition.issues[0]!.message, 400, "INVALID_STATUS_TRANSITION");
    }

    if (payout.status !== "PENDING") {
      throw new AdminPartnerPayoutServiceError("Yalnızca bekleyen ödemeler işaretlenebilir.", 400, "INVALID_STATUS_TRANSITION");
    }

    revalidateEarningsStillEligible(
      payout.earnings,
      payoutId,
      payout.partnerId,
      payout.currency
    );

    const total = payout.earnings.reduce((sum, e) => sum + Number(e.amount), 0);
    if (Math.abs(total - Number(payout.amount)) > 0.009) {
      throw new AdminPartnerPayoutServiceError("Ödeme tutarı hak ediş toplamıyla uyuşmuyor.", 400, "TOTAL_MISMATCH");
    }

    await assertPaymentReferenceUnique(tx, paymentReference, payout.partnerId, payoutId);

    const now = new Date();

    const updated = await tx.partnerPayout.update({
      where: { id: payoutId, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: now,
        paymentReference,
        paidByUserId: actorUserId,
      },
    });

    await tx.partnerEarning.updateMany({
      where: { payoutId, status: { in: ["APPROVED", "PAYABLE"] } },
      data: { status: "PAID", paidAt: now },
    });

    await logAdminPartnerPayoutAudit({
      userId: actorUserId,
      action: "PARTNER_PAYOUT_PAID",
      payoutId,
      partnerId: payout.partnerId,
      displayMessage: `Partner ödemesi ödendi olarak işaretlendi: ${payout.partner.fullName}`,
      metadata: {
        reason: parsed.reason,
        paymentReference,
        paidAt: now.toISOString(),
        paidByUserId: actorUserId,
      },
      tx,
    });

    return updated;
  });

  invalidateAdminPartnerPayoutCaches(result.partnerId);
  return {
    id: result.id,
    status: result.status,
    paidAt: result.paidAt?.toISOString() ?? null,
    paymentReference: result.paymentReference,
  };
}
