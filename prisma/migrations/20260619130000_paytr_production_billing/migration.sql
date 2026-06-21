-- PayTR production billing extension.
-- Existing manual/TRIAL MembershipPayment rows are preserved as legacy records.

ALTER TYPE "MembershipPaymentStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "MembershipPaymentStatus" ADD VALUE IF NOT EXISTS 'FORM_READY';
ALTER TYPE "MembershipPaymentStatus" ADD VALUE IF NOT EXISTS 'WAIT_CALLBACK';
ALTER TYPE "MembershipPaymentStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';
ALTER TYPE "MembershipPaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCEL_AT_PERIOD_END';

CREATE TYPE "PaymentProvider" AS ENUM ('PAYTR', 'LEGACY', 'MANUAL');
CREATE TYPE "MembershipPaymentType" AS ENUM ('INITIAL_SUBSCRIPTION', 'SUBSCRIPTION_RENEWAL', 'MANUAL_RENEWAL', 'PLAN_UPGRADE', 'ADD_ON', 'LEGACY');
CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PROVIDER_DELETED', 'UNKNOWN');
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'INVALID', 'FAILED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN');
CREATE TYPE "BillingRunStatus" AS ENUM ('CREATED', 'PROCESSING', 'WAIT_CALLBACK', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'UNKNOWN');
CREATE TYPE "BillingOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "BillingOutboxEventType" AS ENUM ('PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_PAST_DUE', 'SUBSCRIPTION_SUSPENDED', 'REFUND_SUCCEEDED', 'PAYMENT_METHOD_EXPIRED');

ALTER TABLE "CompanySubscription"
  ADD COLUMN "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN "nextBillingAt" TIMESTAMP(3),
  ADD COLUMN "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessfulPaymentId" TEXT,
  ADD COLUMN "lastPaymentAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentFailureAt" TIMESTAMP(3),
  ADD COLUMN "defaultPaymentMethodId" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "failedPaymentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceLockedUntil" TIMESTAMP(3);

ALTER TABLE "MembershipPayment"
  ADD COLUMN "type" "MembershipPaymentType" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "providerEnum" "PaymentProvider",
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "merchantOid" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "subscriptionId" TEXT,
  ADD COLUMN "paymentMethodId" TEXT,
  ADD COLUMN "installmentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "amountMinor" INTEGER,
  ADD COLUMN "subtotalMinor" INTEGER,
  ADD COLUMN "vatMinor" INTEGER,
  ADD COLUMN "discountMinor" INTEGER,
  ADD COLUMN "refundedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "planNameSnapshot" TEXT,
  ADD COLUMN "billingPeriodSnapshot" TEXT,
  ADD COLUMN "periodMonthsSnapshot" INTEGER,
  ADD COLUMN "priceSnapshot" JSONB,
  ADD COLUMN "planEntitlementsSnapshot" JSONB,
  ADD COLUMN "payerEmail" TEXT,
  ADD COLUMN "payerName" TEXT,
  ADD COLUMN "payerPhone" TEXT,
  ADD COLUMN "payerIp" TEXT,
  ADD COLUMN "failedReasonCode" TEXT,
  ADD COLUMN "failedReasonMessage" TEXT,
  ADD COLUMN "testMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "initiatedByUserId" TEXT,
  ADD COLUMN "initiatedAt" TIMESTAMP(3),
  ADD COLUMN "providerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "callbackReceivedAt" TIMESTAMP(3),
  ADD COLUMN "metadata" JSONB;

CREATE TABLE "CompanyPaymentMethod" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYTR',
  "externalUserTokenEncrypted" TEXT NOT NULL,
  "externalCardTokenEncrypted" TEXT NOT NULL,
  "externalTokenFingerprint" TEXT NOT NULL,
  "displayName" TEXT,
  "cardBrand" TEXT,
  "cardFamily" TEXT,
  "bankName" TEXT,
  "maskedPan" TEXT,
  "lastFour" TEXT,
  "expiryMonth" INTEGER,
  "expiryYear" INTEGER,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" "PaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
  "consentVersion" TEXT NOT NULL,
  "consentTextSnapshot" TEXT,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "consentIp" TEXT,
  "providerCreatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "providerDeletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYTR',
  "eventKey" TEXT NOT NULL,
  "merchantOid" TEXT NOT NULL,
  "paymentId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sourceIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYTR',
  "referenceNo" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "reason" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "providerStatus" TEXT,
  "providerResponse" JSONB,
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionBillingRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "paymentId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "BillingRunStatus" NOT NULL DEFAULT 'CREATED',
  "attemptNo" INTEGER NOT NULL DEFAULT 1,
  "nextRetryAt" TIMESTAMP(3),
  "lockToken" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionBillingRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentReconciliation" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYTR',
  "localStatus" TEXT NOT NULL,
  "providerStatus" TEXT NOT NULL,
  "localAmountMinor" INTEGER NOT NULL,
  "providerAmountMinor" INTEGER,
  "discrepancyType" TEXT,
  "details" JSONB,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingOutboxEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "BillingOutboxEventType" NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "BillingOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingOutboxEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PartnerEarning"
  ADD COLUMN "membershipPaymentId" TEXT,
  ADD COLUMN "reversalOfEarningId" TEXT;

CREATE UNIQUE INDEX "MembershipPayment_merchantOid_key" ON "MembershipPayment"("merchantOid");
CREATE UNIQUE INDEX "MembershipPayment_companyId_idempotencyKey_key" ON "MembershipPayment"("companyId", "idempotencyKey");
CREATE INDEX "MembershipPayment_companyId_status_createdAt_idx" ON "MembershipPayment"("companyId", "status", "createdAt");
CREATE INDEX "MembershipPayment_subscriptionId_status_idx" ON "MembershipPayment"("subscriptionId", "status");
CREATE INDEX "MembershipPayment_status_createdAt_idx" ON "MembershipPayment"("status", "createdAt");
CREATE INDEX "MembershipPayment_paymentMethodId_idx" ON "MembershipPayment"("paymentMethodId");

CREATE UNIQUE INDEX "CompanyPaymentMethod_companyId_externalTokenFingerprint_key" ON "CompanyPaymentMethod"("companyId", "externalTokenFingerprint");
CREATE INDEX "CompanyPaymentMethod_companyId_status_idx" ON "CompanyPaymentMethod"("companyId", "status");
CREATE INDEX "CompanyPaymentMethod_companyId_isDefault_idx" ON "CompanyPaymentMethod"("companyId", "isDefault");

CREATE UNIQUE INDEX "PaymentWebhookEvent_eventKey_key" ON "PaymentWebhookEvent"("eventKey");
CREATE INDEX "PaymentWebhookEvent_merchantOid_idx" ON "PaymentWebhookEvent"("merchantOid");
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");
CREATE INDEX "PaymentWebhookEvent_processingStatus_receivedAt_idx" ON "PaymentWebhookEvent"("processingStatus", "receivedAt");

CREATE UNIQUE INDEX "PaymentRefund_referenceNo_key" ON "PaymentRefund"("referenceNo");
CREATE INDEX "PaymentRefund_companyId_status_idx" ON "PaymentRefund"("companyId", "status");
CREATE INDEX "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

CREATE UNIQUE INDEX "SubscriptionBillingRun_paymentId_key" ON "SubscriptionBillingRun"("paymentId");
CREATE UNIQUE INDEX "SubscriptionBillingRun_subscriptionId_periodStart_key" ON "SubscriptionBillingRun"("subscriptionId", "periodStart");
CREATE INDEX "SubscriptionBillingRun_status_scheduledAt_idx" ON "SubscriptionBillingRun"("status", "scheduledAt");
CREATE INDEX "SubscriptionBillingRun_nextRetryAt_status_idx" ON "SubscriptionBillingRun"("nextRetryAt", "status");
CREATE INDEX "SubscriptionBillingRun_companyId_status_idx" ON "SubscriptionBillingRun"("companyId", "status");

CREATE INDEX "PaymentReconciliation_paymentId_idx" ON "PaymentReconciliation"("paymentId");
CREATE INDEX "PaymentReconciliation_provider_checkedAt_idx" ON "PaymentReconciliation"("provider", "checkedAt");
CREATE INDEX "PaymentReconciliation_resolvedAt_idx" ON "PaymentReconciliation"("resolvedAt");

CREATE INDEX "BillingOutboxEvent_companyId_status_availableAt_idx" ON "BillingOutboxEvent"("companyId", "status", "availableAt");
CREATE INDEX "BillingOutboxEvent_aggregateType_aggregateId_idx" ON "BillingOutboxEvent"("aggregateType", "aggregateId");

CREATE UNIQUE INDEX "PartnerEarning_membershipPaymentId_key" ON "PartnerEarning"("membershipPaymentId");
CREATE INDEX "PartnerEarning_membershipPaymentId_idx" ON "PartnerEarning"("membershipPaymentId");

ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_defaultPaymentMethodId_fkey" FOREIGN KEY ("defaultPaymentMethodId") REFERENCES "CompanyPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "CompanyPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyPaymentMethod" ADD CONSTRAINT "CompanyPaymentMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBillingRun" ADD CONSTRAINT "SubscriptionBillingRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBillingRun" ADD CONSTRAINT "SubscriptionBillingRun_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionBillingRun" ADD CONSTRAINT "SubscriptionBillingRun_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingOutboxEvent" ADD CONSTRAINT "BillingOutboxEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_membershipPaymentId_fkey" FOREIGN KEY ("membershipPaymentId") REFERENCES "MembershipPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
