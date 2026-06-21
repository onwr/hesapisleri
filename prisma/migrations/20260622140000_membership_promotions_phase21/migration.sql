-- Membership promotions phase 2.1: refund policy + bulk batch export

CREATE TYPE "DiscountRefundPolicy" AS ENUM (
  'KEEP_REDEMPTION',
  'RELEASE_ON_FULL_REFUND',
  'RELEASE_ALWAYS',
  'MANUAL_REVIEW'
);

ALTER TABLE "MembershipCampaign"
  ADD COLUMN "refundPolicy" "DiscountRefundPolicy" NOT NULL DEFAULT 'RELEASE_ON_FULL_REFUND',
  ADD COLUMN "restoreUsageOnFullRefund" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "restoreUsageOnPartialRefund" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MembershipCoupon"
  ADD COLUMN "refundPolicy" "DiscountRefundPolicy" NOT NULL DEFAULT 'RELEASE_ON_FULL_REFUND',
  ADD COLUMN "restoreUsageOnFullRefund" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "restoreUsageOnPartialRefund" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "batchId" TEXT;

CREATE TABLE "MembershipCouponBatch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "couponCount" INTEGER NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "downloadTokenHash" TEXT,
  "downloadExpiresAt" TIMESTAMP(3),
  "downloadedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipCouponBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipCouponBatchCode" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  CONSTRAINT "MembershipCouponBatchCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MembershipCouponBatch_createdByUserId_idx" ON "MembershipCouponBatch"("createdByUserId");
CREATE INDEX "MembershipCouponBatchCode_batchId_idx" ON "MembershipCouponBatchCode"("batchId");
CREATE UNIQUE INDEX "MembershipCouponBatchCode_batchId_couponId_key" ON "MembershipCouponBatchCode"("batchId", "couponId");

ALTER TABLE "MembershipCoupon"
  ADD CONSTRAINT "MembershipCoupon_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "MembershipCouponBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipCouponBatchCode"
  ADD CONSTRAINT "MembershipCouponBatchCode_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "MembershipCouponBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
