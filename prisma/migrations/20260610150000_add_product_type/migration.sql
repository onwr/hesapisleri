-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProductType" AS ENUM ('STOCK', 'SERVICE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "ProductUnitType" ADD VALUE IF NOT EXISTS 'HOUR';
ALTER TYPE "ProductUnitType" ADD VALUE IF NOT EXISTS 'DAY';
ALTER TYPE "ProductUnitType" ADD VALUE IF NOT EXISTS 'JOB';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" "ProductType" NOT NULL DEFAULT 'STOCK';
