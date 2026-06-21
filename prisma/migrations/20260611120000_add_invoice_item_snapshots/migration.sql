-- CreateEnum
CREATE TYPE "FinancialSnapshotStatus" AS ENUM ('COMPLETE', 'INFERRED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "totalDiscount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "taxableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "totalVat" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "financialSnapshotStatus" "FinancialSnapshotStatus" NOT NULL DEFAULT 'NEEDS_REVIEW';

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "sourceSaleItemId" TEXT,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "discountRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineNetAmount" DECIMAL(65,30) NOT NULL,
    "vatRate" DECIMAL(65,30) NOT NULL,
    "vatAmount" DECIMAL(65,30) NOT NULL,
    "lineGrossAmount" DECIMAL(65,30) NOT NULL,
    "lineIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
