export const PRICE_PREVIEW_ISSUE_CODES = [
  "PLAN_PRICE_NOT_FOUND",
  "PRICE_RESOLUTION_CONFLICT",
  "CURRENCY_MISMATCH",
  "PLAN_ARCHIVED",
  "PLAN_NOT_PUBLIC",
  "CAMPAIGN_NOT_ELIGIBLE",
  "COUPON_NOT_ELIGIBLE",
  "COUPON_USAGE_LIMIT_REACHED",
  "STACKING_CONFLICT",
  "ADDON_PRICE_NOT_FOUND",
  "ADDON_CURRENCY_MISMATCH",
  "LOCKED_PRICE_NOT_FOUND",
  "NEXT_PRICE_NOT_FOUND",
  "ENTITLEMENT_RESOLUTION_WARNING",
] as const;

export type PricePreviewIssueCode = (typeof PRICE_PREVIEW_ISSUE_CODES)[number];

export type PricePreviewIssue = {
  code: PricePreviewIssueCode;
  message: string;
  severity: "error" | "warning";
};

export type PricePreviewScenario = "NEW_SUBSCRIPTION" | "RENEWAL" | "PLAN_CHANGE";

/** Anonim checkout — gerçek firmaya bağlı olmayan sentinel ID */
export const ANONYMOUS_PREVIEW_COMPANY_ID = "00000000-0000-0000-0000-000000000001";
