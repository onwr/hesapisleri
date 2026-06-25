-- Satış iptal audit alanları ve düzenlenebilir satış tarihi

ALTER TABLE "Sale" ADD COLUMN "saleDate" TIMESTAMP(3);
UPDATE "Sale" SET "saleDate" = "createdAt" WHERE "saleDate" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "saleDate" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "saleDate" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Sale" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN "cancelNote" TEXT;

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sale_companyId_saleDate_idx" ON "Sale"("companyId", "saleDate");
