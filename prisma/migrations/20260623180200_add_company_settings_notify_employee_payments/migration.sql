-- CompanySettings notification field (schema drift fix)
ALTER TABLE "CompanySettings"
ADD COLUMN IF NOT EXISTS "notifyEmployeePayments" BOOLEAN NOT NULL DEFAULT true;
