-- Employee payment idempotency (company-scoped, concurrency-safe, process/instance independent)
CREATE TYPE "EmployeePaymentIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "EmployeePaymentIdempotency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "EmployeePaymentIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "paymentId" TEXT,
    "userId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeePaymentIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeePaymentIdempotency_companyId_idempotencyKey_key" ON "EmployeePaymentIdempotency"("companyId", "idempotencyKey");

CREATE INDEX "EmployeePaymentIdempotency_companyId_employeeId_idx" ON "EmployeePaymentIdempotency"("companyId", "employeeId");

CREATE INDEX "EmployeePaymentIdempotency_companyId_status_idx" ON "EmployeePaymentIdempotency"("companyId", "status");

ALTER TABLE "EmployeePaymentIdempotency" ADD CONSTRAINT "EmployeePaymentIdempotency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
