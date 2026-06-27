-- Migration: admin_payment_management
-- AdminPaymentNote for platform payment investigation notes.

CREATE TYPE "AdminPaymentNoteCategory" AS ENUM (
  'GENERAL',
  'PAYMENT',
  'CALLBACK',
  'REFUND',
  'BILLING',
  'RISK',
  'SUPPORT',
  'TECHNICAL'
);

CREATE TABLE "AdminPaymentNote" (
    "id"           TEXT         NOT NULL,
    "paymentId"    TEXT         NOT NULL,
    "authorUserId" TEXT,
    "content"      TEXT         NOT NULL,
    "category"     "AdminPaymentNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "priority"     "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
    "isPinned"     BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "AdminPaymentNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminPaymentNote"
    ADD CONSTRAINT "AdminPaymentNote_paymentId_fkey"
    FOREIGN KEY ("paymentId")
    REFERENCES "MembershipPayment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminPaymentNote"
    ADD CONSTRAINT "AdminPaymentNote_authorUserId_fkey"
    FOREIGN KEY ("authorUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdminPaymentNote_paymentId_deletedAt_idx"
    ON "AdminPaymentNote"("paymentId", "deletedAt");
CREATE INDEX "AdminPaymentNote_paymentId_isPinned_idx"
    ON "AdminPaymentNote"("paymentId", "isPinned");
CREATE INDEX "AdminPaymentNote_authorUserId_idx"
    ON "AdminPaymentNote"("authorUserId");
