-- AlterEnum
ALTER TYPE "PartnerProfileStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- CreateTable
CREATE TABLE "AdminPartnerNote" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "category" "AdminPlanNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminPartnerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminPartnerNote_partnerId_deletedAt_idx" ON "AdminPartnerNote"("partnerId", "deletedAt");

-- CreateIndex
CREATE INDEX "AdminPartnerNote_partnerId_isPinned_idx" ON "AdminPartnerNote"("partnerId", "isPinned");

-- CreateIndex
CREATE INDEX "AdminPartnerNote_authorUserId_idx" ON "AdminPartnerNote"("authorUserId");

-- AddForeignKey
ALTER TABLE "AdminPartnerNote" ADD CONSTRAINT "AdminPartnerNote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPartnerNote" ADD CONSTRAINT "AdminPartnerNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
