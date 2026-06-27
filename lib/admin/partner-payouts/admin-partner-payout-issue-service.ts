import type { PartnerEarning, PartnerPayout, PartnerProfile } from "@prisma/client";

export type PayoutIssueCode =
  | "PAYMENT_PROFILE_MISSING"
  | "PAYOUT_WITHOUT_EARNINGS"
  | "EARNING_ALREADY_ASSIGNED"
  | "PARTNER_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "TOTAL_MISMATCH"
  | "INVALID_STATUS_TRANSITION"
  | "ARCHIVED_PARTNER"
  | "PAID_WITHOUT_REFERENCE"
  | "EARNING_STATUS_MISMATCH"
  | "PAYOUT_BELOW_MINIMUM_THRESHOLD"
  | "THRESHOLD_NOT_CONFIGURED_FOR_CURRENCY";

export type PayoutIssue = {
  code: PayoutIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

const ELIGIBLE_EARNING_STATUSES = new Set(["APPROVED", "PAYABLE"]);
const PAID_EARNING_STATUS = "PAID";

export function assertValidPayoutStatusTransition(
  from: string,
  to: string
): { ok: true } | { ok: false; issues: PayoutIssue[] } {
  const allowed: Record<string, string[]> = {
    DRAFT: ["PENDING", "CANCELLED"],
    PENDING: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };
  if ((allowed[from] ?? []).includes(to)) return { ok: true };
  return {
    ok: false,
    issues: [
      {
        code: "INVALID_STATUS_TRANSITION",
        severity: "error",
        message: `${from} durumundan ${to} durumuna geçiş yapılamaz.`,
      },
    ],
  };
}

export function isPaymentProfileComplete(
  partner: Pick<PartnerProfile, "iban" | "payoutMethod" | "accountHolderName">,
  paymentMethod: string
): boolean {
  if (paymentMethod === "IBAN") {
    return Boolean(partner.iban?.trim() && partner.accountHolderName?.trim());
  }
  return true;
}

export type PayoutIssueInput = {
  payout: Pick<
    PartnerPayout,
    | "id"
    | "partnerId"
    | "amount"
    | "currency"
    | "status"
    | "paymentMethod"
    | "note"
    | "paymentReference"
  >;
  partner: Pick<PartnerProfile, "id" | "status" | "iban" | "payoutMethod" | "accountHolderName">;
  earnings: Array<
    Pick<PartnerEarning, "id" | "partnerId" | "amount" | "currency" | "status" | "payoutId">
  >;
};

export function detectPayoutIssues(input: PayoutIssueInput): PayoutIssue[] {
  const issues: PayoutIssue[] = [];
  const { payout, partner, earnings } = input;

  if (partner.status === "ARCHIVED") {
    issues.push({
      code: "ARCHIVED_PARTNER",
      severity: "error",
      message: "Partner arşivlenmiş.",
    });
  }

  if (!earnings.length) {
    issues.push({
      code: "PAYOUT_WITHOUT_EARNINGS",
      severity: "error",
      message: "Ödemeye bağlı hak ediş yok.",
    });
  }

  if (!isPaymentProfileComplete(partner, payout.paymentMethod)) {
    issues.push({
      code: "PAYMENT_PROFILE_MISSING",
      severity: "warning",
      message: "Ödeme profili eksik (IBAN veya hesap sahibi).",
    });
  }

  const currencies = new Set(earnings.map((e) => e.currency));
  if (currencies.size > 1) {
    issues.push({
      code: "CURRENCY_MISMATCH",
      severity: "error",
      message: "Hak edişlerde para birimi tutarsız.",
    });
  } else if (earnings.length && earnings[0]!.currency !== payout.currency) {
    issues.push({
      code: "CURRENCY_MISMATCH",
      severity: "error",
      message: "Ödeme para birimi hak edişlerle uyuşmuyor.",
    });
  }

  const earningSum = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
  if (earnings.length && Math.abs(earningSum - Number(payout.amount)) > 0.009) {
    issues.push({
      code: "TOTAL_MISMATCH",
      severity: "error",
      message: "Ödeme tutarı hak ediş toplamıyla uyuşmuyor.",
    });
  }

  for (const earning of earnings) {
    if (earning.partnerId !== payout.partnerId) {
      issues.push({
        code: "PARTNER_MISMATCH",
        severity: "error",
        message: "Hak ediş partneri ödeme partneriyle uyuşmuyor.",
      });
      break;
    }
  }

  if (payout.status === "PAID" && !payout.paymentReference?.trim()) {
    issues.push({
      code: "PAID_WITHOUT_REFERENCE",
      severity: "warning",
      message: "Ödenmiş kayıtta ödeme referansı eksik.",
    });
  }

  for (const earning of earnings) {
    if (earning.payoutId && earning.payoutId !== payout.id) {
      issues.push({
        code: "EARNING_ALREADY_ASSIGNED",
        severity: "error",
        message: "Hak ediş başka bir ödemeye atanmış.",
      });
      break;
    }
  }

  if (payout.status === "DRAFT" || payout.status === "PENDING") {
    for (const earning of earnings) {
      if (!ELIGIBLE_EARNING_STATUSES.has(earning.status)) {
        issues.push({
          code: "EARNING_STATUS_MISMATCH",
          severity: "error",
          message: "Bekleyen ödemede uygun olmayan hak ediş durumu var.",
        });
        break;
      }
    }
  } else if (payout.status === "PAID") {
    const bad = earnings.some((e) => e.status !== PAID_EARNING_STATUS);
    if (bad) {
      issues.push({
        code: "EARNING_STATUS_MISMATCH",
        severity: "warning",
        message: "Ödenmiş kayıtta hak ediş durumu tutarsız.",
      });
    }
  }

  return issues;
}

export function validateEarningsForCreate(
  earnings: Array<
    Pick<PartnerEarning, "id" | "partnerId" | "amount" | "currency" | "status" | "payoutId" | "createdAt">
  >,
  opts?: { periodStart?: Date; periodEnd?: Date }
): { ok: true; partnerId: string; currency: string; total: number } | { ok: false; issues: PayoutIssue[] } {
  const issues: PayoutIssue[] = [];

  if (!earnings.length) {
    return {
      ok: false,
      issues: [{ code: "PAYOUT_WITHOUT_EARNINGS", severity: "error", message: "Hak ediş seçilmedi." }],
    };
  }

  const partnerIds = new Set(earnings.map((e) => e.partnerId));
  if (partnerIds.size > 1) {
    issues.push({
      code: "PARTNER_MISMATCH",
      severity: "error",
      message: "Tüm hak edişler aynı partnere ait olmalı.",
    });
  }

  const currencies = new Set(earnings.map((e) => e.currency));
  if (currencies.size > 1) {
    issues.push({
      code: "CURRENCY_MISMATCH",
      severity: "error",
      message: "Farklı para birimleri aynı ödemede birleştirilemez.",
    });
  }

  for (const earning of earnings) {
    if (!ELIGIBLE_EARNING_STATUSES.has(earning.status)) {
      issues.push({
        code: "EARNING_STATUS_MISMATCH",
        severity: "error",
        message: `Hak ediş ${earning.id} ödeme için uygun değil.`,
      });
    }
    if (earning.payoutId) {
      issues.push({
        code: "EARNING_ALREADY_ASSIGNED",
        severity: "error",
        message: `Hak ediş ${earning.id} zaten bir ödemeye bağlı.`,
      });
    }
    if (opts?.periodStart && earning.createdAt < opts.periodStart) {
      issues.push({
        code: "EARNING_STATUS_MISMATCH",
        severity: "error",
        message: "Hak ediş dönem başlangıcından önce.",
      });
    }
    if (opts?.periodEnd && earning.createdAt > opts.periodEnd) {
      issues.push({
        code: "EARNING_STATUS_MISMATCH",
        severity: "error",
        message: "Hak ediş dönem bitişinden sonra.",
      });
    }
  }

  if (issues.length) return { ok: false, issues };

  const partnerId = earnings[0]!.partnerId;
  const currency = earnings[0]!.currency;
  const total = earnings.reduce((sum, e) => sum + Number(e.amount), 0);

  return { ok: true, partnerId, currency, total };
}

/** Minimum payout threshold applies to TRY only; other currencies skip (no invented thresholds). */
export function validatePayoutMinimumThreshold(
  total: number,
  currency: string,
  minimumPayoutAmount: number
): { ok: true } | { ok: false; code: PayoutIssueCode; message: string } {
  if (currency !== "TRY") {
    return { ok: true };
  }
  if (minimumPayoutAmount <= 0) {
    return { ok: true };
  }
  if (total < minimumPayoutAmount) {
    return {
      ok: false,
      code: "PAYOUT_BELOW_MINIMUM_THRESHOLD",
      message: `Ödeme tutarı minimum eşikten (${minimumPayoutAmount} TRY) düşük.`,
    };
  }
  return { ok: true };
}
