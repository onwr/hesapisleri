-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "defaultVatRate" INTEGER NOT NULL DEFAULT 20,
    "defaultInvoiceType" "InvoiceType" NOT NULL DEFAULT 'E_ARCHIVE',
    "invoiceNumberPrefix" TEXT NOT NULL DEFAULT 'FTR',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 30,
    "invoiceNoteTemplate" TEXT,
    "defaultCollectionAccountId" TEXT,
    "defaultExpenseAccountId" TEXT,
    "autoCreateCashAccount" BOOLEAN NOT NULL DEFAULT true,
    "hideInactiveAccounts" BOOLEAN NOT NULL DEFAULT true,
    "notifyLowStock" BOOLEAN NOT NULL DEFAULT true,
    "notifyDueInvoices" BOOLEAN NOT NULL DEFAULT true,
    "notifyLateCollections" BOOLEAN NOT NULL DEFAULT true,
    "notifyDailySummary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
