-- CreateEnum
CREATE TYPE "AdminCompanyNoteCategory" AS ENUM ('GENERAL', 'BILLING', 'SUPPORT', 'RISK', 'SALES', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "AdminCompanyNotePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "suspendedUntil" TIMESTAMP(3),
ADD COLUMN     "suspendedByUserId" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT;

-- CreateTable
CREATE TABLE "AdminCompanyNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "AdminCompanyNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminCompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByAdminId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminCompanyNote_companyId_deletedAt_idx" ON "AdminCompanyNote"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "AdminCompanyNote_companyId_isPinned_idx" ON "AdminCompanyNote"("companyId", "isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "AdminCompanyNote" ADD CONSTRAINT "AdminCompanyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCompanyNote" ADD CONSTRAINT "AdminCompanyNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
