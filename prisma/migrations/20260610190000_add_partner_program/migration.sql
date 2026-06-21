-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerAudienceType" AS ENUM ('BUSINESS', 'INFLUENCER', 'AGENCY', 'CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerProfileStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PartnerBadgeType" AS ENUM ('NONE', 'PARTNER', 'VERIFIED', 'INFLUENCER', 'CELEBRITY', 'VIP');

-- CreateEnum
CREATE TYPE "PartnerPayoutMethod" AS ENUM ('IBAN', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerConversionType" AS ENUM ('SIGNUP', 'PAID_MEMBERSHIP', 'RENEWAL');

-- CreateEnum
CREATE TYPE "PartnerConversionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerConversionSource" AS ENUM ('COOKIE', 'REFERRAL_CODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PartnerEarningStatus" AS ENUM ('PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerPayoutPaymentMethod" AS ENUM ('IBAN', 'CASH', 'MANUAL');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "referringPartnerId" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PartnerApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "socialUrl" TEXT,
    "audienceType" "PartnerAudienceType" NOT NULL DEFAULT 'OTHER',
    "message" TEXT,
    "expectedReach" TEXT,
    "status" "PartnerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "userId" TEXT,
    "companyId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "referralCode" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "status" "PartnerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "badgeType" "PartnerBadgeType" NOT NULL DEFAULT 'NONE',
    "badgeLabel" TEXT,
    "payoutMethod" "PartnerPayoutMethod",
    "iban" TEXT,
    "bankName" TEXT,
    "accountHolderName" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReferralClick" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedCompanyId" TEXT,
    "convertedUserId" TEXT,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerReferralClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerConversion" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "clickId" TEXT,
    "companyId" TEXT,
    "userId" TEXT,
    "type" "PartnerConversionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PartnerConversionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PartnerConversionSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerEarning" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "conversionId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PartnerEarningStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PartnerPayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" "PartnerPayoutPaymentMethod" NOT NULL DEFAULT 'MANUAL',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSettings" (
    "id" TEXT NOT NULL,
    "defaultCommissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "cookieDurationDays" INT NOT NULL DEFAULT 30,
    "minimumPayoutAmount" DECIMAL(18,2) NOT NULL DEFAULT 500,
    "autoApproveConversions" BOOLEAN NOT NULL DEFAULT false,
    "commissionOnRenewals" BOOLEAN NOT NULL DEFAULT true,
    "isApplicationOpen" BOOLEAN NOT NULL DEFAULT true,
    "termsText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_applicationId_key" ON "PartnerProfile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_referralCode_key" ON "PartnerProfile"("referralCode");

-- CreateIndex
CREATE INDEX "PartnerApplication_email_idx" ON "PartnerApplication"("email");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_idx" ON "PartnerApplication"("status");

-- CreateIndex
CREATE INDEX "PartnerProfile_email_idx" ON "PartnerProfile"("email");

-- CreateIndex
CREATE INDEX "PartnerProfile_status_idx" ON "PartnerProfile"("status");

-- CreateIndex
CREATE INDEX "PartnerProfile_userId_idx" ON "PartnerProfile"("userId");

-- CreateIndex
CREATE INDEX "PartnerReferralClick_partnerId_idx" ON "PartnerReferralClick"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerReferralClick_referralCode_idx" ON "PartnerReferralClick"("referralCode");

-- CreateIndex
CREATE INDEX "PartnerReferralClick_clickedAt_idx" ON "PartnerReferralClick"("clickedAt");

-- CreateIndex
CREATE INDEX "PartnerConversion_partnerId_idx" ON "PartnerConversion"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerConversion_companyId_idx" ON "PartnerConversion"("companyId");

-- CreateIndex
CREATE INDEX "PartnerConversion_type_idx" ON "PartnerConversion"("type");

-- CreateIndex
CREATE INDEX "PartnerConversion_status_idx" ON "PartnerConversion"("status");

-- CreateIndex
CREATE INDEX "PartnerEarning_partnerId_idx" ON "PartnerEarning"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerEarning_status_idx" ON "PartnerEarning"("status");

-- CreateIndex
CREATE INDEX "PartnerEarning_payoutId_idx" ON "PartnerEarning"("payoutId");

-- CreateIndex
CREATE INDEX "PartnerPayout_partnerId_idx" ON "PartnerPayout"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerPayout_status_idx" ON "PartnerPayout"("status");

-- CreateIndex
CREATE INDEX "Company_referringPartnerId_idx" ON "Company"("referringPartnerId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_referringPartnerId_fkey" FOREIGN KEY ("referringPartnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferralClick" ADD CONSTRAINT "PartnerReferralClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerConversion" ADD CONSTRAINT "PartnerConversion_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerConversion" ADD CONSTRAINT "PartnerConversion_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "PartnerReferralClick"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerConversion" ADD CONSTRAINT "PartnerConversion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "PartnerConversion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerEarning" ADD CONSTRAINT "PartnerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PartnerSettings" (
    "id",
    "defaultCommissionRate",
    "cookieDurationDays",
    "minimumPayoutAmount",
    "autoApproveConversions",
    "commissionOnRenewals",
    "isApplicationOpen",
    "termsText",
    "createdAt",
    "updatedAt"
) VALUES (
    'default',
    10,
    30,
    500,
    false,
    true,
    true,
    'Ortaklık programına başvurarak komisyon ve ödeme koşullarını kabul etmiş olursunuz.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
