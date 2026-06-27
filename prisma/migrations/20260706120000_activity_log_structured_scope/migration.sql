-- Faz 6.3.1: ActivityLog structured scope (entityType, entityId, metadata)
ALTER TABLE "ActivityLog" ADD COLUMN "entityType" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "entityId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "metadata" JSONB;

CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
CREATE INDEX "ActivityLog_module_createdAt_idx" ON "ActivityLog"("module", "createdAt");
