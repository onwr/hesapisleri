-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "nextPaymentDate" TIMESTAMP(3),
ADD COLUMN     "monthlyFee" DECIMAL(65,30) NOT NULL DEFAULT 1499,
ADD COLUMN     "membershipNote" TEXT;
