-- Invoice collection idempotency (company-scoped, concurrency-safe)
CREATE TYPE "InvoiceCollectionIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "InvoiceCollectionIdempotency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "InvoiceCollectionIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "invoiceId" TEXT,
    "accountTransactionId" TEXT,
    "userId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceCollectionIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceCollectionIdempotency_companyId_idempotencyKey_key" ON "InvoiceCollectionIdempotency"("companyId", "idempotencyKey");

CREATE INDEX "InvoiceCollectionIdempotency_companyId_status_idx" ON "InvoiceCollectionIdempotency"("companyId", "status");

ALTER TABLE "InvoiceCollectionIdempotency" ADD CONSTRAINT "InvoiceCollectionIdempotency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
