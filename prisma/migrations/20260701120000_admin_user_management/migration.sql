-- Migration: admin_user_management
-- Adds: sessionVersion, lastLoginAt, loginTrackingStatus, suspend metadata,
--       emailVerificationStatus, AdminUserNote table.
-- Does NOT recreate PasswordResetToken (already exists in 20260630120000).

-- ──────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────

CREATE TYPE "LoginTrackingStatus" AS ENUM ('UNKNOWN_LEGACY', 'NEVER_LOGGED_IN', 'LOGGED_IN');

CREATE TYPE "EmailVerificationStatus" AS ENUM ('NOT_TRACKED', 'PENDING', 'VERIFIED');

CREATE TYPE "AdminUserNoteCategory" AS ENUM (
  'GENERAL', 'BILLING', 'SUPPORT', 'RISK', 'FRAUD', 'TECHNICAL'
);

-- ──────────────────────────────────────────────
-- User — session invalidation
-- ──────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- ──────────────────────────────────────────────
-- User — login tracking
-- ──────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "loginTrackingStatus" "LoginTrackingStatus" NOT NULL DEFAULT 'UNKNOWN_LEGACY';

-- ──────────────────────────────────────────────
-- User — suspend metadata
-- ──────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN "suspendedAt"        TIMESTAMP(3),
  ADD COLUMN "suspendedReason"    TEXT,
  ADD COLUMN "suspendedUntil"     TIMESTAMP(3),
  ADD COLUMN "suspendedByAdminId" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_suspendedByAdminId_fkey"
  FOREIGN KEY ("suspendedByAdminId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- User — email verification tracking
-- ──────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN "emailVerificationStatus" "EmailVerificationStatus" NOT NULL DEFAULT 'NOT_TRACKED';

-- ──────────────────────────────────────────────
-- AdminUserNote
-- ──────────────────────────────────────────────

CREATE TABLE "AdminUserNote" (
  "id"           TEXT      NOT NULL,
  "userId"       TEXT      NOT NULL,
  "authorUserId" TEXT,
  "content"      TEXT      NOT NULL,
  "category"     "AdminUserNoteCategory"    NOT NULL DEFAULT 'GENERAL',
  "priority"     "AdminCompanyNotePriority" NOT NULL DEFAULT 'NORMAL',
  "isPinned"     BOOLEAN   NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt"    TIMESTAMP(3),

  CONSTRAINT "AdminUserNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminUserNote_userId_deletedAt_idx"
  ON "AdminUserNote"("userId", "deletedAt");

CREATE INDEX "AdminUserNote_userId_isPinned_idx"
  ON "AdminUserNote"("userId", "isPinned");

ALTER TABLE "AdminUserNote"
  ADD CONSTRAINT "AdminUserNote_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- authorUserId nullable + SET NULL: admin silinse bile notlar korunur.
ALTER TABLE "AdminUserNote"
  ADD CONSTRAINT "AdminUserNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
