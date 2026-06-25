import { createHash } from "node:crypto";
import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { checkAndNotifyMonthlyCostAlert } from "@/lib/ai/ai-cost-alert-service";

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
};

export function estimateAiCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
) {
  const rates = COST_PER_1K[model] || COST_PER_1K["gpt-4o-mini"];
  return (
    (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output
  );
}

export async function logAiUsage(input: {
  companyId: string;
  userId: string;
  conversationId?: string | null;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  toolNames: string[];
  success: boolean;
  errorCode?: string | null;
}) {
  const totalTokens = input.promptTokens + input.completionTokens;
  const estimatedCostUsd = estimateAiCostUsd(
    input.model,
    input.promptTokens,
    input.completionTokens
  );

  const log = await db.aIUsageLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      conversationId: input.conversationId || null,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens,
      estimatedCostUsd,
      durationMs: input.durationMs,
      toolNames: input.toolNames,
      success: input.success,
      errorCode: input.errorCode || null,
    },
  });

  if (input.success) {
    await checkAndNotifyMonthlyCostAlert(input.companyId).catch(() => undefined);
  }

  return log;
}

export async function logToolExecution(input: {
  conversationId: string;
  toolName: string;
  inputPayload: unknown;
  success: boolean;
  durationMs: number;
  errorCode?: string | null;
}) {
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input.inputPayload || {}))
    .digest("hex")
    .slice(0, 16);

  return db.aIToolExecution.create({
    data: {
      conversationId: input.conversationId,
      toolName: input.toolName,
      inputHash,
      success: input.success,
      durationMs: input.durationMs,
      errorCode: input.errorCode || null,
    },
  });
}

export async function getMonthlyAiUsageSummary(companyId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const logs = await db.aIUsageLog.findMany({
    where: { companyId, createdAt: { gte: monthStart }, success: true },
    select: {
      totalTokens: true,
      estimatedCostUsd: true,
      toolNames: true,
    },
  });

  const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
  const estimatedCostUsd = logs.reduce(
    (sum, log) => sum + Number(log.estimatedCostUsd || 0),
    0
  );
  const toolCounts = new Map<string, number>();
  for (const log of logs) {
    for (const tool of log.toolNames) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }
  }

  return {
    requestCount: logs.length,
    totalTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    topTools: [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  };
}

export async function getCompanyUsageStats(
  companyId: string,
  where?: Prisma.AIUsageLogWhereInput
) {
  const logs = await db.aIUsageLog.findMany({
    where: { companyId, ...where },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      provider: true,
      model: true,
      totalTokens: true,
      estimatedCostUsd: true,
      durationMs: true,
      toolNames: true,
      success: true,
      errorCode: true,
      createdAt: true,
    },
  });

  return logs.map((log) => ({
    ...log,
    estimatedCostUsd: log.estimatedCostUsd
      ? Number(log.estimatedCostUsd)
      : null,
  }));
}
