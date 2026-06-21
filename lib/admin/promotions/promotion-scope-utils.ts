import type { MembershipPeriod } from "@prisma/client";

const INTERVAL_LABELS: Record<MembershipPeriod, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

type ScopeRow = {
  plan?: { id: string; name: string } | null;
  billingInterval?: MembershipPeriod | null;
  company?: { id: string; name: string } | null;
  partner?: { id: string; fullName?: string | null; referralCode?: string | null } | null;
  firstPaymentOnly?: boolean;
  renewalAllowed?: boolean;
};

export function formatIntervalLabel(interval?: MembershipPeriod | null) {
  if (!interval) return "Tüm Dönemler";
  return INTERVAL_LABELS[interval] ?? interval;
}

export function formatCampaignScopeSummary(scopes: ScopeRow[]) {
  if (!scopes.length) return "Tüm Planlar · Tüm Dönemler";

  const planNames = [
    ...new Set(scopes.map((s) => s.plan?.name).filter(Boolean) as string[]),
  ];
  const intervals = [
    ...new Set(scopes.map((s) => s.billingInterval).filter(Boolean) as MembershipPeriod[]),
  ];
  const companies = scopes.filter((s) => s.company).length;
  const partners = scopes.filter((s) => s.partner).length;
  const parts: string[] = [];

  if (planNames.length) parts.push(planNames.join(" + "));
  else parts.push("Tüm Planlar");

  if (intervals.length === 1) parts.push(`Yalnız ${formatIntervalLabel(intervals[0])}`);
  else if (intervals.length > 1) {
    parts.push(intervals.map((i) => formatIntervalLabel(i)).join(", "));
  }

  if (companies) parts.push(`${companies} Firma`);
  if (partners) {
    const partnerName = scopes.find((s) => s.partner)?.partner;
    parts.push(`Partner: ${partnerName?.fullName ?? partnerName?.referralCode ?? "—"}`);
  }

  return parts.join(" · ");
}

export function formatCouponPlanSummary(
  planScopes: Array<{ plan: { name: string } }>
) {
  if (!planScopes.length) return "Tüm Planlar";
  return planScopes.map((p) => p.plan.name).join(" + ");
}

export function formatCouponIntervalSummary(intervals: MembershipPeriod[]) {
  if (!intervals.length) return "Tüm Dönemler";
  if (intervals.length === 1) return formatIntervalLabel(intervals[0]);
  return intervals.map((i) => formatIntervalLabel(i)).join(", ");
}

export function formatDiscountLabel(
  discountType: string,
  discountValue: number,
  formatMoney: (minor: number) => string
) {
  if (discountType === "PERCENTAGE") return `%${discountValue}`;
  return formatMoney(discountValue);
}

export function escapeCsvCell(value: string) {
  const dangerous = /^[=+\-@]/;
  const normalized = dangerous.test(value) ? `'${value}` : value;
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}
