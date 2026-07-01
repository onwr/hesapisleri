-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('OPENING_BALANCE', 'PAYMENT', 'COLLECTION', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "openingBalanceDate" TIMESTAMP(3),
ADD COLUMN "openingBalanceNote" TEXT,
ADD COLUMN "linkedCustomerId" TEXT;

-- CreateTable
CREATE TABLE "SupplierLedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierLedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceEffect" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "reason" TEXT,
    "expenseId" TEXT,
    "accountTransactionId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AccountTransaction" ADD COLUMN "supplierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_accountTransactionId_key" ON "SupplierLedgerEntry"("accountTransactionId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_companyId_supplierId_idx" ON "SupplierLedgerEntry"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierId_date_idx" ON "SupplierLedgerEntry"("supplierId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_companyId_sourceType_sourceId_key" ON "SupplierLedgerEntry"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_companyId_idempotencyKey_key" ON "SupplierLedgerEntry"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Supplier_linkedCustomerId_idx" ON "Supplier"("linkedCustomerId");

-- CreateIndex
CREATE INDEX "AccountTransaction_supplierId_idx" ON "AccountTransaction"("supplierId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_linkedCustomerId_fkey" FOREIGN KEY ("linkedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_accountTransactionId_fkey" FOREIGN KEY ("accountTransactionId") REFERENCES "AccountTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
