-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN "note" TEXT;
ALTER TABLE "ProductCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_companyId_name_key" ON "ProductCategory"("companyId", "name");
