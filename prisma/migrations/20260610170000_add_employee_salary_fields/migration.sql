-- EmployeeSalary tablosu henüz oluşturulmamış ortamlarda migration'ı bloklamaz.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'EmployeeSalary'
  ) THEN
    ALTER TABLE "EmployeeSalary"
    ADD COLUMN IF NOT EXISTS "grossAmount" DECIMAL(18, 2),
    ADD COLUMN IF NOT EXISTS "paymentDay" INTEGER,
    ADD COLUMN IF NOT EXISTS "iban" TEXT,
    ADD COLUMN IF NOT EXISTS "bankName" TEXT;
  END IF;
END $$;
