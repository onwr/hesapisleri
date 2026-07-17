-- CreateEnum
CREATE TYPE "CashDailyClosingStatus" AS ENUM ('CLOSED');

-- CreateTable
CREATE TABLE "CashDailyClosing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "expectedCashAmount" DECIMAL(65,30) NOT NULL,
    "countedCashAmount" DECIMAL(65,30) NOT NULL,
    "differenceAmount" DECIMAL(65,30) NOT NULL,
    "totalCashSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCardSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCreditSales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCollections" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalExpenses" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTransfersIn" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTransfersOut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "CashDailyClosingStatus" NOT NULL DEFAULT 'CLOSED',
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashDailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashDailyClosing_companyId_closingDate_idx" ON "CashDailyClosing"("companyId", "closingDate");

-- CreateIndex
CREATE INDEX "CashDailyClosing_accountId_idx" ON "CashDailyClosing"("accountId");

-- CreateIndex
CREATE INDEX "CashDailyClosing_closedByUserId_idx" ON "CashDailyClosing"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CashDailyClosing_companyId_accountId_closingDate_key" ON "CashDailyClosing"("companyId", "accountId", "closingDate");

-- AddForeignKey
ALTER TABLE "CashDailyClosing" ADD CONSTRAINT "CashDailyClosing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDailyClosing" ADD CONSTRAINT "CashDailyClosing_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDailyClosing" ADD CONSTRAINT "CashDailyClosing_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
