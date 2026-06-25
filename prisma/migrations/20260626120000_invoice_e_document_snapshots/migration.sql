-- Invoice e-belge snapshot alanları ve mükellef cache tabloları (Faz 3.2)

CREATE TYPE "EDocumentSnapshotStatus" AS ENUM ('PREVIEW', 'READY', 'LOCKED');

ALTER TABLE "Invoice"
  ADD COLUMN "sellerSnapshot" JSONB,
  ADD COLUMN "buyerSnapshot" JSONB,
  ADD COLUMN "lineSnapshots" JSONB,
  ADD COLUMN "internetSaleSnapshot" JSONB,
  ADD COLUMN "financialSnapshot" JSONB,
  ADD COLUMN "eDocumentSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "eDocumentSnapshotStatus" "EDocumentSnapshotStatus",
  ADD COLUMN "eDocumentRevisionHash" TEXT,
  ADD COLUMN "eDocumentSnapshotHash" TEXT;

CREATE TABLE "EDocumentGibUserListCache" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "syncOperation" TEXT NOT NULL,
  "userIndex" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EDocumentGibUserListCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EDocumentTaxpayerLookupCache" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taxId" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EDocumentTaxpayerLookupCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EDocumentGibUserListCache_companyId_key" ON "EDocumentGibUserListCache"("companyId");
CREATE INDEX "EDocumentGibUserListCache_companyId_idx" ON "EDocumentGibUserListCache"("companyId");
CREATE INDEX "EDocumentGibUserListCache_expiresAt_idx" ON "EDocumentGibUserListCache"("expiresAt");

CREATE UNIQUE INDEX "EDocumentTaxpayerLookupCache_companyId_taxId_key" ON "EDocumentTaxpayerLookupCache"("companyId", "taxId");
CREATE INDEX "EDocumentTaxpayerLookupCache_companyId_idx" ON "EDocumentTaxpayerLookupCache"("companyId");
CREATE INDEX "EDocumentTaxpayerLookupCache_expiresAt_idx" ON "EDocumentTaxpayerLookupCache"("expiresAt");

ALTER TABLE "EDocumentGibUserListCache"
  ADD CONSTRAINT "EDocumentGibUserListCache_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EDocumentTaxpayerLookupCache"
  ADD CONSTRAINT "EDocumentTaxpayerLookupCache_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
