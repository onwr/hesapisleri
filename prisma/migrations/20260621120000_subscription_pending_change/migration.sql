-- CreateEnum
CREATE TYPE "SubscriptionPendingChangeType" AS ENUM ('PLAN', 'INTERVAL', 'PLAN_AND_INTERVAL');

-- CreateEnum
CREATE TYPE "SubscriptionPendingChangeStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "SubscriptionPendingChange" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "changeType" "SubscriptionPendingChangeType" NOT NULL,
    "targetPlanId" TEXT,
    "targetPlanPriceId" TEXT,
    "targetBillingInterval" "MembershipPeriod",
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionPendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT,
    "reason" TEXT,
    "estimatedPriceMinor" INTEGER,
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPendingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionPendingChange_subscriptionId_status_idx" ON "SubscriptionPendingChange"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionPendingChange_effectiveAt_status_idx" ON "SubscriptionPendingChange"("effectiveAt", "status");

-- AddForeignKey
ALTER TABLE "SubscriptionPendingChange" ADD CONSTRAINT "SubscriptionPendingChange_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BillingOutboxEventType extensions
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_TRIAL_EXTENDED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_GRACE_EXTENDED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PLAN_CHANGE_SCHEDULED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PLAN_CHANGED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_INTERVAL_CHANGE_SCHEDULED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_INTERVAL_CHANGED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_AUTO_RENEW_ENABLED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_AUTO_RENEW_DISABLED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCEL_SCHEDULED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCEL_REVOKED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_SPECIAL_PRICE_CREATED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PRICE_LOCKED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PRICE_UNLOCKED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_MANUALLY_EXTENDED';
