-- CreateEnum
CREATE TYPE "DiscountRedemptionType" AS ENUM ('CAMPAIGN', 'COUPON');

-- CreateEnum
CREATE TYPE "DiscountRedemptionStatus" AS ENUM ('RESERVED', 'FINALIZED', 'RELEASED', 'REFUNDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MembershipCampaignStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "MembershipCouponStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- AlterTable MembershipCampaign
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "overridePriceMinor" INTEGER;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "minimumAmountMinor" INTEGER;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "firstPaymentOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "renewalAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "publishedByUserId" TEXT;
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "MembershipCampaign" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable MembershipCampaignScope
ALTER TABLE "MembershipCampaignScope" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
CREATE INDEX IF NOT EXISTS "MembershipCampaignScope_partnerId_idx" ON "MembershipCampaignScope"("partnerId");
ALTER TABLE "MembershipCampaignScope" ADD CONSTRAINT "MembershipCampaignScope_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable MembershipCoupon
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "overridePriceMinor" INTEGER;
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "renewalAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "newCustomersOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "MembershipCoupon" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MembershipDiscountRedemption" (
    "id" TEXT NOT NULL,
    "type" "DiscountRedemptionType" NOT NULL,
    "campaignId" TEXT,
    "couponId" TEXT,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "paymentId" TEXT,
    "billingInterval" "MembershipPeriod" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "DiscountRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipDiscountRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipDiscountRedemption_idempotencyKey_key" ON "MembershipDiscountRedemption"("idempotencyKey");
CREATE UNIQUE INDEX "MembershipDiscountRedemption_paymentId_couponId_key" ON "MembershipDiscountRedemption"("paymentId", "couponId");
CREATE UNIQUE INDEX "MembershipDiscountRedemption_paymentId_campaignId_key" ON "MembershipDiscountRedemption"("paymentId", "campaignId");
CREATE INDEX "MembershipDiscountRedemption_companyId_status_idx" ON "MembershipDiscountRedemption"("companyId", "status");
CREATE INDEX "MembershipDiscountRedemption_expiresAt_status_idx" ON "MembershipDiscountRedemption"("expiresAt", "status");
CREATE INDEX "MembershipDiscountRedemption_couponId_companyId_idx" ON "MembershipDiscountRedemption"("couponId", "companyId");
CREATE INDEX "MembershipDiscountRedemption_campaignId_companyId_idx" ON "MembershipDiscountRedemption"("campaignId", "companyId");

ALTER TABLE "MembershipDiscountRedemption" ADD CONSTRAINT "MembershipDiscountRedemption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MembershipCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipDiscountRedemption" ADD CONSTRAINT "MembershipDiscountRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "MembershipCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipDiscountRedemption" ADD CONSTRAINT "MembershipDiscountRedemption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipDiscountRedemption" ADD CONSTRAINT "MembershipDiscountRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BillingOutboxEventType extensions
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_STARTED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_ENDING';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_ENDED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'COUPON_APPLIED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'COUPON_REJECTED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'COUPON_USAGE_LIMIT_REACHED';
