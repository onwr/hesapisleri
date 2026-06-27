-- CreateEnum
CREATE TYPE "CompanyOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "CompanyOnboarding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "CompanyOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "flowVersion" INTEGER NOT NULL DEFAULT 1,
    "checklistDismissedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOnboarding_companyId_key" ON "CompanyOnboarding"("companyId");

-- CreateIndex
CREATE INDEX "CompanyOnboarding_companyId_status_idx" ON "CompanyOnboarding"("companyId", "status");

-- AddForeignKey
ALTER TABLE "CompanyOnboarding" ADD CONSTRAINT "CompanyOnboarding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyOnboarding" ADD CONSTRAINT "CompanyOnboarding_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
