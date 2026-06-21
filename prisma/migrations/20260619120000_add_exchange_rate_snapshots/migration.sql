-- CreateEnum
CREATE TYPE "ExchangeRateSnapshotStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "ExchangeRateSnapshot" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "rates" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "windowKey" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ExchangeRateSnapshotStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRateSnapshot_windowKey_key" ON "ExchangeRateSnapshot"("windowKey");

-- CreateIndex
CREATE INDEX "ExchangeRateSnapshot_fetchedAt_idx" ON "ExchangeRateSnapshot"("fetchedAt");

-- CreateIndex
CREATE INDEX "ExchangeRateSnapshot_status_fetchedAt_idx" ON "ExchangeRateSnapshot"("status", "fetchedAt");
