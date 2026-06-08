-- CreateEnum
CREATE TYPE "ProductUnitType" AS ENUM ('PIECE', 'KG', 'METER', 'LITER', 'PACK');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minStock" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Product" ADD COLUMN     "unitType" "ProductUnitType" NOT NULL DEFAULT 'PIECE';
ALTER TABLE "Product" ADD COLUMN     "warehouseLocation" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");
CREATE UNIQUE INDEX "Product_companyId_barcode_key" ON "Product"("companyId", "barcode");
