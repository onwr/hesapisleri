-- AlterTable
ALTER TABLE "PartnerPayout" ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paidByUserId" TEXT;

-- CreateIndex
CREATE INDEX "PartnerPayout_paidByUserId_idx" ON "PartnerPayout"("paidByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayout_partnerId_paymentReference_key" ON "PartnerPayout"("partnerId", "paymentReference");

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
