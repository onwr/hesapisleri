-- Sovos e-document provider (Faz 1)

ALTER TYPE "EDocumentProvider" ADD VALUE 'SOVOS';

ALTER TYPE "EfaturamIntegrationStatus" ADD VALUE 'PARTIALLY_CONNECTED';

ALTER TABLE "EfaturamIntegration"
  ADD COLUMN IF NOT EXISTS "taxId" TEXT,
  ADD COLUMN IF NOT EXISTS "senderIdentifier" TEXT,
  ADD COLUMN IF NOT EXISTS "receiverIdentifier" TEXT,
  ADD COLUMN IF NOT EXISTS "branchCode" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceSeries" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveSeries" TEXT,
  ADD COLUMN IF NOT EXISTS "capabilities" JSONB,
  ADD COLUMN IF NOT EXISTS "lastTestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSuccessfulAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorMessage" TEXT;
