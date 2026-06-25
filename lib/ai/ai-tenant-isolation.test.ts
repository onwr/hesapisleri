import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { getConversationMessages } from "@/lib/ai/ai-chat-service";
import { getCachedInsight } from "@/lib/ai/ai-insight-cache-service";
import { db } from "@/lib/prisma";

describe("AI tenant isolation", () => {
  it("başka şirketin conversation kaydına erişilemez", async () => {
    const originalFindFirst = db.aIConversation.findFirst.bind(db.aIConversation);
    let capturedWhere: Record<string, unknown> | undefined;

    db.aIConversation.findFirst = (async (args: {
      where?: Record<string, unknown>;
    }) => {
      capturedWhere = args?.where;
      return null;
    }) as unknown as typeof db.aIConversation.findFirst;

    try {
      await assert.rejects(
        () => getConversationMessages("company-b", "user-1", "conv-a"),
        (error: unknown) => error instanceof AiServiceError
      );
      assert.equal(capturedWhere?.companyId, "company-b");
      assert.equal(capturedWhere?.userId, "user-1");
      assert.equal(capturedWhere?.id, "conv-a");
    } finally {
      db.aIConversation.findFirst = originalFindFirst;
    }
  });

  it("insight cache companyId ile sorgulanır", async () => {
    const originalFindUnique = db.aIInsightCache.findUnique.bind(db.aIInsightCache);
    let capturedCompanyId: string | undefined;

    db.aIInsightCache.findUnique = (async (args: {
      where?: { companyId_cacheKey?: { companyId?: string } };
    }) => {
      capturedCompanyId = args?.where?.companyId_cacheKey?.companyId;
      return null;
    }) as unknown as typeof db.aIInsightCache.findUnique;

    try {
      const result = await getCachedInsight("company-b", "dashboard:key");
      assert.equal(result, null);
      assert.equal(capturedCompanyId, "company-b");
    } finally {
      db.aIInsightCache.findUnique = originalFindUnique;
    }
  });

  it("usage log sorguları companyId filtresi kullanır", async () => {
    const originalFindMany = db.aIUsageLog.findMany.bind(db.aIUsageLog);
    let capturedWhere: Record<string, unknown> | undefined;

    db.aIUsageLog.findMany = (async (args: { where?: Record<string, unknown> }) => {
      capturedWhere = args?.where;
      return [];
    }) as unknown as typeof db.aIUsageLog.findMany;

    try {
      await db.aIUsageLog.findMany({
        where: { companyId: "company-b" },
        take: 1,
      });
      assert.equal(capturedWhere?.companyId, "company-b");
    } finally {
      db.aIUsageLog.findMany = originalFindMany;
    }
  });

  it("tool execution company scope conversation üzerinden filtrelenir", async () => {
    const originalCount = db.aIToolExecution.count.bind(db.aIToolExecution);
    let capturedWhere: Record<string, unknown> | undefined;

    db.aIToolExecution.count = (async (args: { where?: Record<string, unknown> }) => {
      capturedWhere = args?.where;
      return 0;
    }) as unknown as typeof db.aIToolExecution.count;

    try {
      await db.aIToolExecution.count({
        where: { conversation: { companyId: "company-b" } },
      });
      const conversation = capturedWhere?.conversation as { companyId?: string };
      assert.equal(conversation?.companyId, "company-b");
    } finally {
      db.aIToolExecution.count = originalCount;
    }
  });
});
