-- CreateEnum
CREATE TYPE "OrderSourceChannel" AS ENUM ('MANUAL', 'POS', 'WEBSITE', 'TRENDYOL', 'HEPSIBURADA', 'N11', 'AMAZON', 'CICEKSEPETI', 'ETSY', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('WAITING', 'APPROVED', 'SHIPPING', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "sourceChannel" "OrderSourceChannel" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "externalOrderId" TEXT,
ADD COLUMN     "orderStatus" "OrderStatus" NOT NULL DEFAULT 'WAITING',
ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "orderNote" TEXT;

-- Backfill existing sales
UPDATE "Sale" SET "orderStatus" = 'CANCELLED' WHERE "status" = 'CANCELLED';
UPDATE "Sale" SET "orderStatus" = 'RETURNED' WHERE "status" = 'REFUNDED';
UPDATE "Sale" SET "orderStatus" = 'WAITING' WHERE "status" = 'DRAFT';
UPDATE "Sale" SET "orderStatus" = 'APPROVED' WHERE "orderStatus" = 'WAITING' AND "status" = 'COMPLETED';

-- CreateIndex
CREATE INDEX "Sale_companyId_orderStatus_idx" ON "Sale"("companyId", "orderStatus");

-- CreateIndex
CREATE INDEX "Sale_companyId_sourceChannel_idx" ON "Sale"("companyId", "sourceChannel");

-- CreateIndex
CREATE INDEX "Sale_companyId_createdAt_idx" ON "Sale"("companyId", "createdAt");
