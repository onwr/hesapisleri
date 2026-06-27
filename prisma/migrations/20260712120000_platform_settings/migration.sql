-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "brandName" TEXT NOT NULL DEFAULT 'Hesap İşleri',
    "supportEmail" TEXT NOT NULL DEFAULT 'destek@hesapisleri.com',
    "supportPhone" TEXT,
    "websiteUrl" TEXT NOT NULL DEFAULT 'https://hesapisleri.com',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "trialAmount" DECIMAL(18,2) NOT NULL DEFAULT 1499,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "defaultVatRate" INTEGER NOT NULL DEFAULT 20,
    "defaultNotifyLowStock" BOOLEAN NOT NULL DEFAULT true,
    "defaultNotifyDueInvoices" BOOLEAN NOT NULL DEFAULT true,
    "defaultNotifyLateCollections" BOOLEAN NOT NULL DEFAULT true,
    "defaultNotifyDailySummary" BOOLEAN NOT NULL DEFAULT false,
    "defaultNotifyEmployeePayments" BOOLEAN NOT NULL DEFAULT true,
    "maxImageBytes" INTEGER NOT NULL DEFAULT 5242880,
    "maxTaxCertificateBytes" INTEGER NOT NULL DEFAULT 5242880,
    "sessionMaxAgeDays" INTEGER NOT NULL DEFAULT 7,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" VARCHAR(500),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlatformSettings" ADD CONSTRAINT "PlatformSettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default singleton
INSERT INTO "PlatformSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
