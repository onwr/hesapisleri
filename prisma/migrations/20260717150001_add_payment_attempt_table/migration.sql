-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'CHECKOUT_LINK_READY', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'SIPAY',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "invoiceId" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "planId" TEXT,
    "planPriceId" TEXT,
    "priceSnapshot" JSONB,
    "payerEmail" TEXT,
    "payerName" TEXT,
    "payerIp" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "providerStatus" TEXT,
    "providerPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_invoiceId_key" ON "PaymentAttempt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_companyId_idx" ON "PaymentAttempt"("companyId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoiceId_idx" ON "PaymentAttempt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

-- CreateIndex
CREATE INDEX "PaymentAttempt_companyId_status_createdAt_idx" ON "PaymentAttempt"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_companyId_idempotencyKey_key" ON "PaymentAttempt"("companyId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
