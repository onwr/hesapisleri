-- Trendyol E-Faturam Phase 1

CREATE TYPE "EfaturamConnectionMode" AS ENUM ('DIRECT_ACCOUNT', 'MARKETPLACE_PARTNER');
CREATE TYPE "EfaturamEnvironment" AS ENUM ('STAGE', 'LIVE');
CREATE TYPE "EfaturamIntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');
CREATE TYPE "InvoiceDocumentType" AS ENUM ('E_INVOICE', 'E_ARCHIVE');
CREATE TYPE "InvoiceDocumentSubmissionStatus" AS ENUM ('DRAFT', 'PENDING', 'SUBMITTED', 'SUCCESS', 'FAILED', 'CANCELLED');

CREATE TABLE "EfaturamIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionMode" "EfaturamConnectionMode" NOT NULL,
    "environment" "EfaturamEnvironment" NOT NULL DEFAULT 'STAGE',
    "status" "EfaturamIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "prefix" TEXT,
    "xsltCode" TEXT,
    "providerCompanyId" TEXT,
    "providerUserId" TEXT,
    "partnerCustomerId" TEXT,
    "credentialsEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EfaturamIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceDocumentSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "documentType" "InvoiceDocumentType" NOT NULL,
    "status" "InvoiceDocumentSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "localReferenceId" TEXT NOT NULL,
    "providerInvoiceUuid" TEXT,
    "providerInvoiceId" TEXT,
    "providerStatus" INTEGER,
    "gibStatusCode" INTEGER,
    "gibStatus" TEXT,
    "targetAlias" TEXT,
    "requestSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "errorDetail" TEXT,
    "usageReservationKey" TEXT,
    "lastQueriedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDocumentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EfaturamIntegration_companyId_key" ON "EfaturamIntegration"("companyId");
CREATE INDEX "EfaturamIntegration_companyId_idx" ON "EfaturamIntegration"("companyId");

CREATE UNIQUE INDEX "InvoiceDocumentSubmission_invoiceId_key" ON "InvoiceDocumentSubmission"("invoiceId");
CREATE UNIQUE INDEX "InvoiceDocumentSubmission_localReferenceId_key" ON "InvoiceDocumentSubmission"("localReferenceId");
CREATE INDEX "InvoiceDocumentSubmission_companyId_idx" ON "InvoiceDocumentSubmission"("companyId");
CREATE INDEX "InvoiceDocumentSubmission_integrationId_idx" ON "InvoiceDocumentSubmission"("integrationId");
CREATE INDEX "InvoiceDocumentSubmission_providerInvoiceUuid_idx" ON "InvoiceDocumentSubmission"("providerInvoiceUuid");

ALTER TABLE "EfaturamIntegration" ADD CONSTRAINT "EfaturamIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocumentSubmission" ADD CONSTRAINT "InvoiceDocumentSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocumentSubmission" ADD CONSTRAINT "InvoiceDocumentSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocumentSubmission" ADD CONSTRAINT "InvoiceDocumentSubmission_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "EfaturamIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
