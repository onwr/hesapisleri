-- Hesaplar arası transfer: iki bacağı ilişkilendiren transferGroupId
ALTER TABLE "AccountTransaction" ADD COLUMN "transferGroupId" TEXT;
CREATE INDEX "AccountTransaction_transferGroupId_idx" ON "AccountTransaction"("transferGroupId");

-- Transfer idempotency (DB-backed, process/instance bağımsız)
CREATE TABLE "AccountTransferIdempotency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "transferGroupId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AccountTransferIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountTransferIdempotency_companyId_idempotencyKey_key" ON "AccountTransferIdempotency"("companyId", "idempotencyKey");

CREATE INDEX "AccountTransferIdempotency_companyId_status_idx" ON "AccountTransferIdempotency"("companyId", "status");

ALTER TABLE "AccountTransferIdempotency" ADD CONSTRAINT "AccountTransferIdempotency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
