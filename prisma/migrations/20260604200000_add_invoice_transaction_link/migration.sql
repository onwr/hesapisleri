-- AlterTable
ALTER TABLE "AccountTransaction" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "AccountTransaction_invoiceId_idx" ON "AccountTransaction"("invoiceId");

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
