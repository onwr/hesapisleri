-- Membership Add-ons, Entitlements, Usage Phase 3

-- CreateEnum
CREATE TYPE "MembershipAddOnStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "MembershipAddOnType" AS ENUM ('RECURRING', 'ONE_TIME', 'USAGE_PACK');
CREATE TYPE "AddOnPriceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "CompanyAddOnSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END', 'CANCELLED', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "CompanyEntitlementOverrideStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "UsageEventAction" AS ENUM ('CONSUME', 'RELEASE', 'ADJUST', 'RESET', 'RESERVE', 'FINALIZE');
CREATE TYPE "UsageCreditStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EntitlementChangePolicy" AS ENUM ('NEW_SUBSCRIBERS_ONLY', 'IMMEDIATE', 'NEXT_RENEWAL', 'GRANDFATHERED');

-- AlterEnum MembershipPaymentType
ALTER TYPE "MembershipPaymentType" ADD VALUE IF NOT EXISTS 'ADD_ON_PURCHASE';
ALTER TYPE "MembershipPaymentType" ADD VALUE IF NOT EXISTS 'ADD_ON_RENEWAL';
ALTER TYPE "MembershipPaymentType" ADD VALUE IF NOT EXISTS 'USAGE_PACK_PURCHASE';

-- AlterEnum BillingOutboxEventType
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_PURCHASED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_RENEWED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_PAYMENT_FAILED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_CANCEL_SCHEDULED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_CANCELLED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ADDON_EXPIRING';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'USAGE_LIMIT_WARNING';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'USAGE_LIMIT_REACHED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ENTITLEMENT_OVERRIDE_STARTED';
ALTER TYPE "BillingOutboxEventType" ADD VALUE IF NOT EXISTS 'ENTITLEMENT_OVERRIDE_EXPIRED';

-- AlterTable PlanEntitlement
ALTER TABLE "PlanEntitlement" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- CreateTable PlanEntitlementVersion
CREATE TABLE "PlanEntitlementVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanPriceStatus" NOT NULL DEFAULT 'DRAFT',
    "changePolicy" "EntitlementChangePolicy" NOT NULL DEFAULT 'NEW_SUBSCRIBERS_ONLY',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "entitlementsJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntitlementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable MembershipAddOn
CREATE TABLE "MembershipAddOn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "MembershipAddOnStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "MembershipAddOnType" NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "entitlementQuantity" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "vatRate" INTEGER NOT NULL DEFAULT 20,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "recurringAllowed" BOOLEAN NOT NULL DEFAULT false,
    "prorationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "carryOver" BOOLEAN NOT NULL DEFAULT false,
    "expiresAfterDays" INTEGER,
    "prerequisiteCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MembershipAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable MembershipAddOnPrice
CREATE TABLE "MembershipAddOnPrice" (
    "id" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "billingInterval" "MembershipPeriod",
    "version" INTEGER NOT NULL DEFAULT 1,
    "listPriceMinor" INTEGER NOT NULL,
    "salePriceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "vatRate" INTEGER NOT NULL DEFAULT 20,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "status" "AddOnPriceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipAddOnPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyAddOnSubscription
CREATE TABLE "CompanyAddOnSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "addOnId" TEXT NOT NULL,
    "addOnPriceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "CompanyAddOnSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "billingInterval" "MembershipPeriod",
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "priceSnapshot" JSONB,
    "entitlementSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAddOnSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyEntitlementOverride
CREATE TABLE "CompanyEntitlementOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "valueType" "PlanEntitlementValueType" NOT NULL DEFAULT 'NUMBER',
    "booleanValue" BOOLEAN,
    "numberValue" INTEGER,
    "stringValue" TEXT,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "reason" TEXT,
    "status" "CompanyEntitlementOverrideStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable UsagePeriod
CREATE TABLE "UsagePeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "limitSnapshot" INTEGER,
    "resetType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable UsageEvent
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "action" "UsageEventAction" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "periodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompanyUsageCredit
CREATE TABLE "CompanyUsageCredit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "granted" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "UsageCreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUsageCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntitlementVersion_planId_version_key" ON "PlanEntitlementVersion"("planId", "version");
CREATE INDEX "PlanEntitlementVersion_planId_status_idx" ON "PlanEntitlementVersion"("planId", "status");

CREATE UNIQUE INDEX "MembershipAddOn_code_key" ON "MembershipAddOn"("code");
CREATE UNIQUE INDEX "MembershipAddOn_slug_key" ON "MembershipAddOn"("slug");
CREATE INDEX "MembershipAddOn_status_type_idx" ON "MembershipAddOn"("status", "type");
CREATE INDEX "MembershipAddOn_entitlementCode_idx" ON "MembershipAddOn"("entitlementCode");

CREATE UNIQUE INDEX "MembershipAddOnPrice_addOnId_billingInterval_version_key" ON "MembershipAddOnPrice"("addOnId", "billingInterval", "version");
CREATE INDEX "MembershipAddOnPrice_addOnId_status_idx" ON "MembershipAddOnPrice"("addOnId", "status");

CREATE INDEX "CompanyAddOnSubscription_companyId_status_idx" ON "CompanyAddOnSubscription"("companyId", "status");
CREATE INDEX "CompanyAddOnSubscription_addOnId_status_idx" ON "CompanyAddOnSubscription"("addOnId", "status");
CREATE INDEX "CompanyAddOnSubscription_subscriptionId_idx" ON "CompanyAddOnSubscription"("subscriptionId");

CREATE INDEX "CompanyEntitlementOverride_companyId_entitlementCode_status_idx" ON "CompanyEntitlementOverride"("companyId", "entitlementCode", "status");

CREATE UNIQUE INDEX "UsagePeriod_companyId_entitlementCode_periodStart_key" ON "UsagePeriod"("companyId", "entitlementCode", "periodStart");
CREATE INDEX "UsagePeriod_companyId_entitlementCode_idx" ON "UsagePeriod"("companyId", "entitlementCode");
CREATE INDEX "UsagePeriod_periodEnd_idx" ON "UsagePeriod"("periodEnd");

CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");
CREATE INDEX "UsageEvent_companyId_entitlementCode_idx" ON "UsageEvent"("companyId", "entitlementCode");
CREATE INDEX "UsageEvent_periodId_idx" ON "UsageEvent"("periodId");

CREATE INDEX "CompanyUsageCredit_companyId_entitlementCode_status_idx" ON "CompanyUsageCredit"("companyId", "entitlementCode", "status");
CREATE INDEX "CompanyUsageCredit_expiresAt_idx" ON "CompanyUsageCredit"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlanEntitlementVersion" ADD CONSTRAINT "PlanEntitlementVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipAddOnPrice" ADD CONSTRAINT "MembershipAddOnPrice_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "MembershipAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyAddOnSubscription" ADD CONSTRAINT "CompanyAddOnSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAddOnSubscription" ADD CONSTRAINT "CompanyAddOnSubscription_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyAddOnSubscription" ADD CONSTRAINT "CompanyAddOnSubscription_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "MembershipAddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyAddOnSubscription" ADD CONSTRAINT "CompanyAddOnSubscription_addOnPriceId_fkey" FOREIGN KEY ("addOnPriceId") REFERENCES "MembershipAddOnPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyEntitlementOverride" ADD CONSTRAINT "CompanyEntitlementOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsagePeriod" ADD CONSTRAINT "UsagePeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "UsagePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyUsageCredit" ADD CONSTRAINT "CompanyUsageCredit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
