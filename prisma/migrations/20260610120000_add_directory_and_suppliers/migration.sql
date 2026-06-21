-- Idempotent migration: safe when objects already exist (e.g. after prisma db push)

DO $$ BEGIN
  CREATE TYPE "DirectoryContactType" AS ENUM ('PERSON', 'COMPANY', 'CUSTOMER', 'EMPLOYEE', 'SUPPLIER', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DirectorySourceType" AS ENUM ('MANUAL', 'CUSTOMER', 'EMPLOYEE', 'SUPPLIER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectoryContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DirectoryContactType" NOT NULL DEFAULT 'PERSON',
    "sourceType" "DirectorySourceType" DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DirectoryContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "taxOffice" TEXT,
    "taxNumber" TEXT,
    "iban" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Türkiye',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "paymentTermDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "supplierBarcode" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "minOrderQuantity" INTEGER,
    "leadTimeDays" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "DirectoryContact_companyId_idx" ON "DirectoryContact"("companyId");
CREATE INDEX IF NOT EXISTS "DirectoryContact_companyId_type_idx" ON "DirectoryContact"("companyId", "type");
CREATE INDEX IF NOT EXISTS "DirectoryContact_companyId_isFavorite_idx" ON "DirectoryContact"("companyId", "isFavorite");
CREATE INDEX IF NOT EXISTS "DirectoryContact_companyId_isActive_idx" ON "DirectoryContact"("companyId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryContact_companyId_sourceType_sourceId_key" ON "DirectoryContact"("companyId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX IF NOT EXISTS "Supplier_companyId_isActive_idx" ON "Supplier"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "Supplier_companyId_isFavorite_idx" ON "Supplier"("companyId", "isFavorite");
CREATE INDEX IF NOT EXISTS "Supplier_companyId_name_idx" ON "Supplier"("companyId", "name");
CREATE INDEX IF NOT EXISTS "Supplier_companyId_taxNumber_idx" ON "Supplier"("companyId", "taxNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_companyId_code_key" ON "Supplier"("companyId", "code");

CREATE INDEX IF NOT EXISTS "SupplierContact_companyId_idx" ON "SupplierContact"("companyId");
CREATE INDEX IF NOT EXISTS "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

CREATE INDEX IF NOT EXISTS "SupplierProduct_companyId_idx" ON "SupplierProduct"("companyId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_supplierId_idx" ON "SupplierProduct"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierProduct_productId_idx" ON "SupplierProduct"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierProduct_companyId_supplierId_productId_key" ON "SupplierProduct"("companyId", "supplierId", "productId");

CREATE INDEX IF NOT EXISTS "Expense_supplierId_idx" ON "Expense"("supplierId");
CREATE INDEX IF NOT EXISTS "StockMovement_supplierId_idx" ON "StockMovement"("supplierId");

DO $$ BEGIN
  ALTER TABLE "DirectoryContact" ADD CONSTRAINT "DirectoryContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DirectoryContact" ADD CONSTRAINT "DirectoryContact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
