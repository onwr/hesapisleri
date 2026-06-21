/**
 * Documented audit exceptions — each entry reviewed for SEC-01.
 */
export type TenantAuditAllowlistEntry = {
  file: string;
  rule:
    | "token-only-api"
    | "findUnique-by-id"
    | "body-company-id"
    | "company-users-fallback";
  reason: string;
  reviewedAt: string;
  owner: string;
  ticketId: string;
};

export const TENANT_AUDIT_ALLOWLIST: TenantAuditAllowlistEntry[] = [
  {
    file: "lib/membership-service.ts",
    rule: "findUnique-by-id",
    reason: "Platform membership plans; global scope, not tenant data.",
    reviewedAt: "2026-06-19",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/partner-service.ts",
    rule: "findUnique-by-id",
    reason: "Partner platform settings; SUPER_ADMIN scoped operations.",
    reviewedAt: "2026-06-19",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/marketplace/marketplace-sync-service.ts",
    rule: "findUnique-by-id",
    reason: "Integration sync reads channel config after tenant-scoped lookup.",
    reviewedAt: "2026-06-19",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "scripts/audit-invoice-tax-snapshots.ts",
    rule: "findUnique-by-id",
    reason: "Internal audit script, not a runtime API.",
    reviewedAt: "2026-06-19",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "app/api/admin/subscriptions/repair-missing/route.ts",
    rule: "body-company-id",
    reason:
      "SUPER_ADMIN platform subscription repair; optional companyId limits backfill scope.",
    reviewedAt: "2026-06-21",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/billing/price-resolution-service.ts",
    rule: "findUnique-by-id",
    reason:
      "Platform MembershipPlan lookup by planId; not tenant-scoped company data.",
    reviewedAt: "2026-06-22",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/membership-plan-price-service.ts",
    rule: "findUnique-by-id",
    reason:
      "SUPER_ADMIN plan price publish by priceId; platform catalog operation.",
    reviewedAt: "2026-06-22",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/admin/promotions/campaign-mutation-service.ts",
    rule: "findUnique-by-id",
    reason:
      "Platform-wide MembershipCampaign; SUPER_ADMIN API only, not tenant data.",
    reviewedAt: "2026-06-22",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/admin/promotions/coupon-mutation-service.ts",
    rule: "findUnique-by-id",
    reason:
      "Platform-wide MembershipCoupon admin mutations; SUPER_ADMIN scoped.",
    reviewedAt: "2026-06-22",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/admin/promotions/campaign-query-service.ts",
    rule: "findUnique-by-id",
    reason:
      "SUPER_ADMIN campaign detail by platform campaign id; not tenant data.",
    reviewedAt: "2026-06-22",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/admin/addons/addon-price-service.ts",
    rule: "findUnique-by-id",
    reason:
      "SUPER_ADMIN add-on price publish by priceId; platform catalog operation.",
    reviewedAt: "2026-06-23",
    owner: "security",
    ticketId: "SEC-01",
  },
  {
    file: "lib/admin/addons/addon-mutation-service.ts",
    rule: "findUnique-by-id",
    reason:
      "Platform-wide MembershipAddOn admin mutations; SUPER_ADMIN scoped.",
    reviewedAt: "2026-06-23",
    owner: "security",
    ticketId: "SEC-01",
  },
];

export function isAllowlisted(
  file: string,
  rule: TenantAuditAllowlistEntry["rule"]
) {
  const normalized = file.replace(/\\/g, "/");
  return TENANT_AUDIT_ALLOWLIST.some(
    (entry) => entry.file === normalized && entry.rule === rule
  );
}
