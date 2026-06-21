import type {
  DiscountType,
  MembershipCampaignStatus,
  MembershipCouponStatus,
  MembershipPeriod,
} from "@prisma/client";

export type CampaignScopeInput = {
  planId?: string | null;
  billingInterval?: MembershipPeriod | null;
  companyId?: string | null;
  partnerId?: string | null;
  firstPaymentOnly?: boolean;
  renewalAllowed?: boolean;
};

export type CampaignListFilters = {
  q?: string;
  status?: MembershipCampaignStatus;
  discountType?: DiscountType;
  planId?: string;
  interval?: MembershipPeriod;
  autoApply?: "true" | "false";
  stackable?: "true" | "false";
  renewalAllowed?: "true" | "false";
  firstPaymentOnly?: "true" | "false";
  companyScoped?: "true" | "false";
  partnerScoped?: "true" | "false";
  startsFrom?: string;
  startsTo?: string;
  endsFrom?: string;
  endsTo?: string;
  sort?: "name" | "startsAt" | "priority" | "created";
  order?: "asc" | "desc";
  page?: number;
};

export type CouponListFilters = {
  q?: string;
  status?: MembershipCouponStatus;
  discountType?: DiscountType;
  planId?: string;
  interval?: MembershipPeriod;
  firstPaymentOnly?: "true" | "false";
  renewalAllowed?: "true" | "false";
  usageStatus?: "available" | "limit_reached" | "expired";
  expiresFrom?: string;
  expiresTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: "code" | "startsAt" | "created" | "expiresAt";
  order?: "asc" | "desc";
  page?: number;
};

export const PROMOTION_PAGE_SIZE = 30;

export type ConflictSeverity = "INFO" | "WARNING" | "BLOCKING";

export type CampaignConflict = {
  severity: ConflictSeverity;
  campaignId: string;
  campaignName: string;
  message: string;
  planName?: string | null;
  billingInterval?: MembershipPeriod | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priority?: number;
  stackable?: boolean;
  autoApply?: boolean;
};
