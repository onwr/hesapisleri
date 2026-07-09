-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Sale_companyId_archivedAt_idx" ON "Sale"("companyId", "archivedAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
