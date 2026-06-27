-- CreateEnum
CREATE TYPE "SystemJobRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "SystemJobRunTrigger" AS ENUM ('CRON', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "SystemJobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "status" "SystemJobRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "SystemJobRunTrigger" NOT NULL,
    "triggeredByUserId" TEXT,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "summary" TEXT,
    "errorCode" TEXT,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemJobRun_idempotencyKey_key" ON "SystemJobRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SystemJobRun_jobKey_startedAt_idx" ON "SystemJobRun"("jobKey", "startedAt");

-- CreateIndex
CREATE INDEX "SystemJobRun_status_startedAt_idx" ON "SystemJobRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SystemJobRun_trigger_startedAt_idx" ON "SystemJobRun"("trigger", "startedAt");

-- AddForeignKey
ALTER TABLE "SystemJobRun" ADD CONSTRAINT "SystemJobRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
