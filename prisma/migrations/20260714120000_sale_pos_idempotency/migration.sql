-- POS checkout idempotency (company-scoped)
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Sale" ADD COLUMN "payloadHash" TEXT;

CREATE UNIQUE INDEX "Sale_companyId_idempotencyKey_key" ON "Sale"("companyId", "idempotencyKey");
