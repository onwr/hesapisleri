-- Migration: admin_subscription_management
-- Adds AdminSubscriptionNote model and extends CompanySubscription
-- with admin-managed metadata fields.

-- AdminSubscriptionNoteCategory enum
CREATE TYPE "AdminSubscriptionNoteCategory" AS ENUM (
  'GENERAL',
  'BILLING',
  'PAYMENT',
  'RETENTION',
  'RISK',
  'SUPPORT',
  'TECHNICAL'
);

-- AdminSubscriptionNote model
CREATE TABLE "AdminSubscriptionNote" (
    "id"             TEXT         NOT NULL,
    "subscriptionId" TEXT         NOT NULL,
    "authorUserId"   TEXT,
    "content"        TEXT         NOT NULL,
    "category"       "AdminSubscriptionNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority"       "AdminCompanyNotePriority"      NOT NULL DEFAULT 'NORMAL',
    "isPinned"       BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "deletedAt"      TIMESTAMP(3),

    CONSTRAINT "AdminSubscriptionNote_pkey" PRIMARY KEY ("id")
);

-- FK: subscriptionId → CompanySubscription (cascade)
ALTER TABLE "AdminSubscriptionNote"
    ADD CONSTRAINT "AdminSubscriptionNote_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId")
    REFERENCES "CompanySubscription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: authorUserId → User (set null so notes survive admin deletion)
ALTER TABLE "AdminSubscriptionNote"
    ADD CONSTRAINT "AdminSubscriptionNote_authorUserId_fkey"
    FOREIGN KEY ("authorUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "AdminSubscriptionNote_subscriptionId_deletedAt_idx"
    ON "AdminSubscriptionNote"("subscriptionId", "deletedAt");
CREATE INDEX "AdminSubscriptionNote_subscriptionId_isPinned_idx"
    ON "AdminSubscriptionNote"("subscriptionId", "isPinned");

-- Extend CompanySubscription with admin-managed fields
ALTER TABLE "CompanySubscription"
    ADD COLUMN IF NOT EXISTS "cancellationScheduledAt"        TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "cancellationScheduledByAdminId" TEXT,
    ADD COLUMN IF NOT EXISTS "internalCancellationNote"       TEXT,
    ADD COLUMN IF NOT EXISTS "trialExtensionReason"           TEXT,
    ADD COLUMN IF NOT EXISTS "lastProviderSyncAt"             TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastProviderSyncStatus"         TEXT;

-- FK: cancellationScheduledByAdminId → User (set null)
ALTER TABLE "CompanySubscription"
    ADD CONSTRAINT "CompanySubscription_cancellationScheduledByAdminId_fkey"
    FOREIGN KEY ("cancellationScheduledByAdminId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for sync status queries
CREATE INDEX "CompanySubscription_lastProviderSyncAt_idx"
    ON "CompanySubscription"("lastProviderSyncAt");
