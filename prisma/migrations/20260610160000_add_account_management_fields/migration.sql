-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'CREDIT_CARD';
ALTER TYPE "AccountType" ADD VALUE 'POS';
ALTER TYPE "AccountType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "branchName" TEXT;
ALTER TABLE "Account" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Account" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "description" TEXT;
