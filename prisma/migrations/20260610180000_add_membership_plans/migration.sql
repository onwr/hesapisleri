-- CreateEnum
CREATE TYPE "MembershipPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY');

-- CreateEnum
CREATE TYPE "MembershipPaymentMethod" AS ENUM ('MANUAL', 'BANK_TRANSFER', 'CREDIT_CARD', 'PAYTR', 'IYZICO', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "MembershipPaymentStatus" ADD VALUE 'REFUNDED';

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(65,30) NOT NULL,
    "quarterlyPrice" DECIMAL(65,30) NOT NULL,
    "semiAnnualPrice" DECIMAL(65,30) NOT NULL,
    "yearlyPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "features" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "lastPaymentId" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MembershipPayment" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "period" "MembershipPeriod",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "paymentMethod" "MembershipPaymentMethod",
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_code_key" ON "MembershipPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySubscription_companyId_key" ON "CompanySubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanySubscription_planId_idx" ON "CompanySubscription"("planId");

-- CreateIndex
CREATE INDEX "CompanySubscription_status_idx" ON "CompanySubscription"("status");

-- CreateIndex
CREATE INDEX "MembershipPayment_planId_idx" ON "MembershipPayment"("planId");

-- CreateIndex
CREATE INDEX "MembershipPayment_status_idx" ON "MembershipPayment"("status");

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default plan
INSERT INTO "MembershipPlan" (
    "id",
    "name",
    "code",
    "description",
    "monthlyPrice",
    "quarterlyPrice",
    "semiAnnualPrice",
    "yearlyPrice",
    "currency",
    "isActive",
    "features",
    "createdAt",
    "updatedAt"
) VALUES (
    'plan-standard',
    'Standart Paket',
    'standard',
    'Hesapisleri.com standart işletme paketi',
    1499,
    3999,
    7499,
    12999,
    'TRY',
    true,
    ARRAY['Sınırsız kullanıcı', 'Satış ve fatura', 'Stok yönetimi', 'Raporlar', 'POS'],
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Backfill subscriptions from latest membership payment per company
INSERT INTO "CompanySubscription" (
    "id",
    "companyId",
    "planId",
    "status",
    "currentPeriodStart",
    "currentPeriodEnd",
    "trialEndsAt",
    "lastPaymentId",
    "autoRenew",
    "createdAt",
    "updatedAt"
)
SELECT
    'sub_' || c."id",
    c."id",
    'plan-standard',
    CASE
        WHEN lp."provider" = 'TRIAL' AND lp."status" = 'PENDING' AND lp."periodEnd" > CURRENT_TIMESTAMP THEN 'TRIAL'::"SubscriptionStatus"
        WHEN lp."periodEnd" IS NOT NULL AND lp."periodEnd" > CURRENT_TIMESTAMP THEN 'ACTIVE'::"SubscriptionStatus"
        WHEN lp."periodEnd" IS NOT NULL AND lp."periodEnd" <= CURRENT_TIMESTAMP THEN 'EXPIRED'::"SubscriptionStatus"
        ELSE 'TRIAL'::"SubscriptionStatus"
    END,
    lp."periodStart",
    lp."periodEnd",
    CASE
        WHEN lp."provider" = 'TRIAL' THEN lp."periodEnd"
        ELSE NULL
    END,
    CASE WHEN lp."status" = 'PAID' THEN lp."id" ELSE NULL END,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Company" c
LEFT JOIN LATERAL (
    SELECT mp.*
    FROM "MembershipPayment" mp
    WHERE mp."companyId" = c."id"
    ORDER BY mp."createdAt" DESC
    LIMIT 1
) lp ON true
WHERE NOT EXISTS (
    SELECT 1 FROM "CompanySubscription" cs WHERE cs."companyId" = c."id"
);
