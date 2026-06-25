-- AI Faz 1: şirket ayarları, konuşma, kullanım, araç ve insight cache modelleri

CREATE TABLE "CompanyAISettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'tr',
    "maxResponseTokens" INTEGER NOT NULL DEFAULT 800,
    "monthlyCostWarningUsd" DECIMAL(10,4),
    "readOnlyMode" BOOLEAN NOT NULL DEFAULT true,
    "requireUserApproval" BOOLEAN NOT NULL DEFAULT true,
    "autoDisableOnCostExceeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAISettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAISettings_companyId_key" ON "CompanyAISettings"("companyId");

CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIConversation_companyId_userId_idx" ON "AIConversation"("companyId", "userId");
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredContent" JSONB,
    "sourceModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6),
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "toolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIUsageLog_companyId_createdAt_idx" ON "AIUsageLog"("companyId", "createdAt");
CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");

CREATE TABLE "AIToolExecution" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "inputHash" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIToolExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIToolExecution_conversationId_createdAt_idx" ON "AIToolExecution"("conversationId", "createdAt");

CREATE TABLE "AIInsightCache" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInsightCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIInsightCache_companyId_cacheKey_key" ON "AIInsightCache"("companyId", "cacheKey");
CREATE INDEX "AIInsightCache_expiresAt_idx" ON "AIInsightCache"("expiresAt");

ALTER TABLE "CompanyAISettings" ADD CONSTRAINT "CompanyAISettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIToolExecution" ADD CONSTRAINT "AIToolExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIInsightCache" ADD CONSTRAINT "AIInsightCache_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
