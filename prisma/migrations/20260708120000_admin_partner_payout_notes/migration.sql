-- CreateTable
CREATE TABLE "AdminPartnerPayoutNote" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "category" "AdminPlanNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminPartnerPayoutNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminPartnerPayoutNote_payoutId_deletedAt_idx" ON "AdminPartnerPayoutNote"("payoutId", "deletedAt");

-- CreateIndex
CREATE INDEX "AdminPartnerPayoutNote_payoutId_isPinned_idx" ON "AdminPartnerPayoutNote"("payoutId", "isPinned");

-- CreateIndex
CREATE INDEX "AdminPartnerPayoutNote_authorUserId_idx" ON "AdminPartnerPayoutNote"("authorUserId");

-- AddForeignKey
ALTER TABLE "AdminPartnerPayoutNote" ADD CONSTRAINT "AdminPartnerPayoutNote_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPartnerPayoutNote" ADD CONSTRAINT "AdminPartnerPayoutNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
