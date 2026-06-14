-- CreateEnum
CREATE TYPE "MarketplaceChannel" AS ENUM ('TRENDYOL', 'HEPSIBURADA');

-- CreateEnum
CREATE TYPE "MarketplaceIntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "MarketplaceSyncRunType" AS ENUM ('MANUAL', 'AUTO', 'TEST');

-- CreateEnum
CREATE TYPE "MarketplaceSyncRunStatus" AS ENUM ('SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'RUNNING');

-- CreateTable
CREATE TABLE "MarketplaceIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "MarketplaceChannel" NOT NULL,
    "status" "MarketplaceIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentialsEncrypted" TEXT,
    "supplierId" TEXT,
    "merchantId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "defaultWarehouseId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncCursor" TEXT,
    "lastSyncStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSyncRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "channel" "MarketplaceChannel" NOT NULL,
    "type" "MarketplaceSyncRunType" NOT NULL,
    "status" "MarketplaceSyncRunStatus" NOT NULL,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChannelMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" "MarketplaceChannel" NOT NULL,
    "merchantSku" TEXT NOT NULL,
    "barcode" TEXT,
    "externalProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductChannelMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceIntegration_companyId_channel_key" ON "MarketplaceIntegration"("companyId", "channel");

-- CreateIndex
CREATE INDEX "MarketplaceIntegration_companyId_idx" ON "MarketplaceIntegration"("companyId");

-- CreateIndex
CREATE INDEX "MarketplaceSyncRun_companyId_idx" ON "MarketplaceSyncRun"("companyId");

-- CreateIndex
CREATE INDEX "MarketplaceSyncRun_integrationId_idx" ON "MarketplaceSyncRun"("integrationId");

-- CreateIndex
CREATE INDEX "MarketplaceSyncRun_channel_idx" ON "MarketplaceSyncRun"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "ProductChannelMapping_companyId_channel_merchantSku_key" ON "ProductChannelMapping"("companyId", "channel", "merchantSku");

-- CreateIndex
CREATE INDEX "ProductChannelMapping_companyId_idx" ON "ProductChannelMapping"("companyId");

-- CreateIndex
CREATE INDEX "ProductChannelMapping_productId_idx" ON "ProductChannelMapping"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_sourceChannel_externalOrderId_key" ON "Sale"("companyId", "sourceChannel", "externalOrderId");

-- AddForeignKey
ALTER TABLE "MarketplaceIntegration" ADD CONSTRAINT "MarketplaceIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceIntegration" ADD CONSTRAINT "MarketplaceIntegration_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSyncRun" ADD CONSTRAINT "MarketplaceSyncRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSyncRun" ADD CONSTRAINT "MarketplaceSyncRun_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "MarketplaceIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelMapping" ADD CONSTRAINT "ProductChannelMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelMapping" ADD CONSTRAINT "ProductChannelMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
