-- Membership plan pricing v2: versioned interval prices, entitlements, campaigns, coupons.

CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PlanVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INTERNAL');
CREATE TYPE "PlanPriceStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "SubscriptionPriceChangePolicy" AS ENUM ('NEW_SUBSCRIBERS_ONLY', 'NEXT_RENEWAL', 'AFTER_DATE', 'GRANDFATHERED');
CREATE TYPE "PlanEntitlementValueType" AS ENUM ('BOOLEAN', 'NUMBER', 'UNLIMITED', 'STRING');
CREATE TYPE "MembershipCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'OVERRIDE_PRICE');
CREATE TYPE "MembershipCouponStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');

ALTER TABLE "MembershipPlan"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "badgeText" TEXT,
  ADD COLUMN "planStatus" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "visibility" "PlanVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "trialEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "autoRenewAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "upgradeAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "downgradeAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cancellationAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'TRY',
  ADD COLUMN "vatRate" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "MembershipPlan" SET "slug" = "code" WHERE "slug" IS NULL;
ALTER TABLE "MembershipPlan" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "MembershipPlan_slug_key" ON "MembershipPlan"("slug");

ALTER TABLE "CompanySubscription"
  ADD COLUMN "billingInterval" "MembershipPeriod",
  ADD COLUMN "lockedPlanPriceId" TEXT,
  ADD COLUMN "lockedPriceMinor" INTEGER,
  ADD COLUMN "lockedListPriceMinor" INTEGER,
  ADD COLUMN "priceLockType" "SubscriptionPriceChangePolicy",
  ADD COLUMN "nextPlanPriceId" TEXT,
  ADD COLUMN "nextPriceEffectiveAt" TIMESTAMP(3);

ALTER TABLE "MembershipPayment"
  ADD COLUMN "planPriceId" TEXT;

CREATE TABLE "MembershipPlanPrice" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "billingInterval" "MembershipPeriod" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "PlanPriceStatus" NOT NULL DEFAULT 'DRAFT',
  "listPriceMinor" INTEGER NOT NULL,
  "salePriceMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "vatRate" INTEGER NOT NULL DEFAULT 20,
  "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
  "monthlyEquivalentMinor" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "isAutoRenewEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "priceChangePolicy" "SubscriptionPriceChangePolicy" NOT NULL DEFAULT 'NEW_SUBSCRIBERS_ONLY',
  "adminNote" TEXT,
  "createdByUserId" TEXT,
  "publishedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipPlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "valueType" "PlanEntitlementValueType" NOT NULL DEFAULT 'BOOLEAN',
  "booleanValue" BOOLEAN,
  "numberValue" INTEGER,
  "stringValue" TEXT,
  "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "status" "MembershipCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "discountType" "DiscountType" NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "maxRedemptionsPerCompany" INTEGER,
  "newCustomersOnly" BOOLEAN NOT NULL DEFAULT false,
  "existingCustomersAllowed" BOOLEAN NOT NULL DEFAULT true,
  "autoApply" BOOLEAN NOT NULL DEFAULT false,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCampaignScope" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "planId" TEXT,
  "billingInterval" "MembershipPeriod",
  "companyId" TEXT,
  "firstPaymentOnly" BOOLEAN NOT NULL DEFAULT false,
  "renewalAllowed" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "MembershipCampaignScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCoupon" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "MembershipCouponStatus" NOT NULL DEFAULT 'DRAFT',
  "discountType" "DiscountType" NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "maxUsage" INTEGER,
  "maxUsagePerCompany" INTEGER NOT NULL DEFAULT 1,
  "minimumAmountMinor" INTEGER,
  "firstPaymentOnly" BOOLEAN NOT NULL DEFAULT true,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "allowedIntervals" "MembershipPeriod"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCouponPlan" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  CONSTRAINT "MembershipCouponPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "paymentId" TEXT,
  "subscriptionId" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipCouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyPlanPriceOverride" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "billingInterval" "MembershipPeriod" NOT NULL,
  "priceMinor" INTEGER NOT NULL,
  "vatRate" INTEGER,
  "vatIncluded" BOOLEAN,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "PlanPriceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyPlanPriceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipPlanPrice_planId_billingInterval_version_key" ON "MembershipPlanPrice"("planId", "billingInterval", "version");
CREATE INDEX "MembershipPlanPrice_planId_billingInterval_status_idx" ON "MembershipPlanPrice"("planId", "billingInterval", "status");
CREATE INDEX "MembershipPlanPrice_effectiveFrom_effectiveUntil_idx" ON "MembershipPlanPrice"("effectiveFrom", "effectiveUntil");
CREATE INDEX "MembershipPlanPrice_status_effectiveFrom_idx" ON "MembershipPlanPrice"("status", "effectiveFrom");

CREATE UNIQUE INDEX "PlanEntitlement_planId_code_key" ON "PlanEntitlement"("planId", "code");
CREATE INDEX "PlanEntitlement_planId_idx" ON "PlanEntitlement"("planId");

CREATE UNIQUE INDEX "MembershipCampaign_code_key" ON "MembershipCampaign"("code");
CREATE INDEX "MembershipCampaign_status_startsAt_endsAt_idx" ON "MembershipCampaign"("status", "startsAt", "endsAt");

CREATE INDEX "MembershipCampaignScope_campaignId_idx" ON "MembershipCampaignScope"("campaignId");
CREATE INDEX "MembershipCampaignScope_planId_idx" ON "MembershipCampaignScope"("planId");
CREATE INDEX "MembershipCampaignScope_companyId_idx" ON "MembershipCampaignScope"("companyId");

CREATE UNIQUE INDEX "MembershipCoupon_code_key" ON "MembershipCoupon"("code");
CREATE INDEX "MembershipCoupon_status_startsAt_expiresAt_idx" ON "MembershipCoupon"("status", "startsAt", "expiresAt");

CREATE UNIQUE INDEX "MembershipCouponPlan_couponId_planId_key" ON "MembershipCouponPlan"("couponId", "planId");

CREATE INDEX "MembershipCouponRedemption_couponId_companyId_idx" ON "MembershipCouponRedemption"("couponId", "companyId");
CREATE INDEX "MembershipCouponRedemption_paymentId_idx" ON "MembershipCouponRedemption"("paymentId");

CREATE INDEX "CompanyPlanPriceOverride_companyId_planId_billingInterval_status_idx" ON "CompanyPlanPriceOverride"("companyId", "planId", "billingInterval", "status");

ALTER TABLE "MembershipPlanPrice" ADD CONSTRAINT "MembershipPlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCampaignScope" ADD CONSTRAINT "MembershipCampaignScope_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MembershipCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCampaignScope" ADD CONSTRAINT "MembershipCampaignScope_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCampaignScope" ADD CONSTRAINT "MembershipCampaignScope_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCouponPlan" ADD CONSTRAINT "MembershipCouponPlan_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "MembershipCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCouponPlan" ADD CONSTRAINT "MembershipCouponPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCouponRedemption" ADD CONSTRAINT "MembershipCouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "MembershipCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCouponRedemption" ADD CONSTRAINT "MembershipCouponRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipCouponRedemption" ADD CONSTRAINT "MembershipCouponRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyPlanPriceOverride" ADD CONSTRAINT "CompanyPlanPriceOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPlanPriceOverride" ADD CONSTRAINT "CompanyPlanPriceOverride_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_lockedPlanPriceId_fkey" FOREIGN KEY ("lockedPlanPriceId") REFERENCES "MembershipPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_nextPlanPriceId_fkey" FOREIGN KEY ("nextPlanPriceId") REFERENCES "MembershipPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "MembershipPlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill versioned prices from legacy plan columns (minor units, TRY).
INSERT INTO "MembershipPlanPrice" (
  "id", "planId", "billingInterval", "version", "status",
  "listPriceMinor", "salePriceMinor", "currency", "vatRate", "vatIncluded",
  "monthlyEquivalentMinor", "effectiveFrom", "isAutoRenewEnabled", "isPublic",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'mpp_' || p."id" || '_monthly_v1',
  p."id",
  'MONTHLY'::"MembershipPeriod",
  1,
  'ACTIVE'::"PlanPriceStatus",
  ROUND(p."monthlyPrice" * 100)::INTEGER,
  ROUND(p."monthlyPrice" * 100)::INTEGER,
  p."currency",
  20,
  false,
  ROUND(p."monthlyPrice" * 100)::INTEGER,
  p."createdAt",
  true,
  true,
  p."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MembershipPlan" p
ON CONFLICT DO NOTHING;

INSERT INTO "MembershipPlanPrice" (
  "id", "planId", "billingInterval", "version", "status",
  "listPriceMinor", "salePriceMinor", "currency", "vatRate", "vatIncluded",
  "monthlyEquivalentMinor", "effectiveFrom", "isAutoRenewEnabled", "isPublic",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'mpp_' || p."id" || '_quarterly_v1',
  p."id",
  'QUARTERLY'::"MembershipPeriod",
  1,
  'ACTIVE'::"PlanPriceStatus",
  ROUND(p."quarterlyPrice" * 100)::INTEGER,
  ROUND(p."quarterlyPrice" * 100)::INTEGER,
  p."currency",
  20,
  false,
  ROUND((p."quarterlyPrice" * 100) / 3)::INTEGER,
  p."createdAt",
  true,
  true,
  p."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MembershipPlan" p
ON CONFLICT DO NOTHING;

INSERT INTO "MembershipPlanPrice" (
  "id", "planId", "billingInterval", "version", "status",
  "listPriceMinor", "salePriceMinor", "currency", "vatRate", "vatIncluded",
  "monthlyEquivalentMinor", "effectiveFrom", "isAutoRenewEnabled", "isPublic",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'mpp_' || p."id" || '_semiannual_v1',
  p."id",
  'SEMI_ANNUAL'::"MembershipPeriod",
  1,
  'ACTIVE'::"PlanPriceStatus",
  ROUND(p."semiAnnualPrice" * 100)::INTEGER,
  ROUND(p."semiAnnualPrice" * 100)::INTEGER,
  p."currency",
  20,
  false,
  ROUND((p."semiAnnualPrice" * 100) / 6)::INTEGER,
  p."createdAt",
  true,
  true,
  p."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MembershipPlan" p
ON CONFLICT DO NOTHING;

INSERT INTO "MembershipPlanPrice" (
  "id", "planId", "billingInterval", "version", "status",
  "listPriceMinor", "salePriceMinor", "currency", "vatRate", "vatIncluded",
  "monthlyEquivalentMinor", "effectiveFrom", "isAutoRenewEnabled", "isPublic",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'mpp_' || p."id" || '_yearly_v1',
  p."id",
  'YEARLY'::"MembershipPeriod",
  1,
  'ACTIVE'::"PlanPriceStatus",
  ROUND(p."yearlyPrice" * 100)::INTEGER,
  ROUND(p."yearlyPrice" * 100)::INTEGER,
  p."currency",
  20,
  false,
  ROUND((p."yearlyPrice" * 100) / 12)::INTEGER,
  p."createdAt",
  true,
  true,
  p."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MembershipPlan" p
ON CONFLICT DO NOTHING;
