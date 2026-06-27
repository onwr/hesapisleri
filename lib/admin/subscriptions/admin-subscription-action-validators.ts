import type { PreviewCanonicalPayload } from "@/lib/admin/subscriptions/admin-subscription-preview-hash";
import {
  verifyPreviewHash,
  PREVIEW_TTL_MS,
} from "@/lib/admin/subscriptions/admin-subscription-preview-hash";

export type ValidationResult =
  | { ok: true }
  | { ok: false; status: number; message: string; code?: string };

export function validateTrialExtension(input: {
  status: string;
  days: number;
  baseDate: Date;
  customDate?: Date;
  now?: Date;
}): ValidationResult {
  if (input.status !== "TRIAL") {
    return {
      ok: false,
      status: 400,
      message: "Yalnızca TRIAL durumundaki abonelikler için trial uzatma yapılabilir",
    };
  }

  const now = input.now ?? new Date();
  const newDate =
    input.customDate ??
    new Date(input.baseDate.getTime() + input.days * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if (newDate > maxDate) {
    return {
      ok: false,
      status: 400,
      message: "Trial süresi bugünden itibaren maksimum 90 gün uzatılabilir",
    };
  }

  if (input.days < 1 && !input.customDate) {
    return { ok: false, status: 400, message: "Uzatma süresi en az 1 gün olmalıdır" };
  }

  return { ok: true };
}

export function validateCancellationSchedule(input: {
  status: string;
  cancelAtPeriodEnd: boolean;
}): ValidationResult {
  if (input.status === "CANCELLED" || input.status === "EXPIRED") {
    return {
      ok: false,
      status: 400,
      message: "Bu abonelik zaten iptal edilmiş veya süresi dolmuş",
    };
  }
  if (input.cancelAtPeriodEnd) {
    return {
      ok: false,
      status: 409,
      message: "Bu abonelik için zaten dönem sonu iptali planlanmış",
    };
  }
  return { ok: true };
}

export function validateCancellationRevoke(input: {
  cancelAtPeriodEnd: boolean;
}): ValidationResult {
  if (!input.cancelAtPeriodEnd) {
    return {
      ok: false,
      status: 400,
      message: "Bu abonelik için planlanmış iptal bulunmuyor",
    };
  }
  return { ok: true };
}

export function interpretPreviewVerification(
  verification: ReturnType<typeof verifyPreviewHash>
): ValidationResult {
  if (verification.expired) {
    return {
      ok: false,
      status: 409,
      message: "Önizleme süresi doldu. Lütfen önizlemeyi yenileyip tekrar onaylayın.",
      code: "PREVIEW_EXPIRED",
    };
  }
  if (verification.tampered || !verification.valid) {
    return {
      ok: false,
      status: 409,
      message:
        "Plan fiyatı değişti veya önizleme geçersiz. Lütfen önizlemeyi yenileyip tekrar onaylayın.",
      code: "PREVIEW_INVALID",
    };
  }
  return { ok: true };
}

export function buildCanonicalPreviewPayload(input: {
  subscriptionId: string;
  companyId: string;
  currentPlanId: string | null;
  currentPlanPriceId: string | null;
  currentBillingInterval: string | null;
  targetPlanId: string;
  targetPlanPriceId: string;
  targetBillingInterval: string;
  currency: string;
  listPriceMinor: number;
  salePriceMinor: number;
  monthlyEquivalentMinor: number;
  discountSummary: string;
  couponId: string | null;
  campaignId: string | null;
  activeAddOnEffectMinor: number;
  effectiveMode: "IMMEDIATELY" | "NEXT_PERIOD";
  issuedAt: number;
  expiresAt: number;
}): PreviewCanonicalPayload {
  return {
    subscriptionId: input.subscriptionId,
    companyId: input.companyId,
    currentPlanId: input.currentPlanId ?? "",
    currentPlanPriceId: input.currentPlanPriceId ?? "",
    currentBillingInterval: input.currentBillingInterval ?? "",
    targetPlanId: input.targetPlanId,
    targetPlanPriceId: input.targetPlanPriceId,
    targetBillingInterval: input.targetBillingInterval,
    currency: input.currency,
    listPriceMinor: input.listPriceMinor,
    salePriceMinor: input.salePriceMinor,
    monthlyEquivalentMinor: input.monthlyEquivalentMinor,
    discountSummary: input.discountSummary,
    couponId: input.couponId,
    campaignId: input.campaignId,
    activeAddOnEffectMinor: input.activeAddOnEffectMinor,
    effectiveMode: input.effectiveMode,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  };
}

export function deriveIssuedAtFromToken(expiresAtMs: number): number {
  return expiresAtMs - PREVIEW_TTL_MS;
}

export type MrrSubInput = {
  companyId: string;
  subscriptionId: string;
  lockedPlanPrice: {
    currency: string;
    monthlyEquivalentMinor: number;
  } | null;
};

export const MRR_POLICY_DESCRIPTION =
  "MRR tüm ACTIVE ve CANCEL_AT_PERIOD_END abonelik kayıtlarının aylık eşdeğer tutarlarını toplar. " +
  "Firma başına tek aktif abonelik iş kuralı geçerlidir; birden fazla aktif kayıt varsa her biri ayrı sayılır ve çift sayım riski oluşur.";

export function calculateMrrWithDuplicateAwareness(subs: MrrSubInput[]): {
  mrrMinor: Record<string, number>;
  duplicateCompanies: Array<{
    companyId: string;
    subscriptionIds: string[];
    excessMrrMinor: Record<string, number>;
  }>;
} {
  const mrrMinor = subs.reduce<Record<string, number>>((acc, sub) => {
    const price = sub.lockedPlanPrice;
    if (!price) return acc;
    const currency = price.currency ?? "TRY";
    const monthly = price.monthlyEquivalentMinor ?? 0;
    if (monthly <= 0) return acc;
    acc[currency] = (acc[currency] ?? 0) + monthly;
    return acc;
  }, {});

  const byCompany = new Map<string, Array<{ subscriptionId: string; monthly: number; currency: string }>>();
  for (const sub of subs) {
    const price = sub.lockedPlanPrice;
    if (!price || (price.monthlyEquivalentMinor ?? 0) <= 0) continue;
    const list = byCompany.get(sub.companyId) ?? [];
    list.push({
      subscriptionId: sub.subscriptionId,
      monthly: price.monthlyEquivalentMinor ?? 0,
      currency: price.currency ?? "TRY",
    });
    byCompany.set(sub.companyId, list);
  }

  const duplicateCompanies: Array<{
    companyId: string;
    subscriptionIds: string[];
    excessMrrMinor: Record<string, number>;
  }> = [];

  for (const [companyId, entries] of byCompany) {
    if (entries.length <= 1) continue;
    const excessMrrMinor: Record<string, number> = {};
    const sorted = [...entries].sort((a, b) => b.monthly - a.monthly);
    for (const entry of sorted.slice(1)) {
      excessMrrMinor[entry.currency] = (excessMrrMinor[entry.currency] ?? 0) + entry.monthly;
    }
    duplicateCompanies.push({
      companyId,
      subscriptionIds: entries.map((e) => e.subscriptionId),
      excessMrrMinor,
    });
  }

  return { mrrMinor, duplicateCompanies };
}
