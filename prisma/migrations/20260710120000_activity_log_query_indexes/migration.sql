-- ActivityLog list/filter performance indexes (Faz 15)
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
CREATE INDEX "ActivityLog_companyId_createdAt_idx" ON "ActivityLog"("companyId", "createdAt");
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");
