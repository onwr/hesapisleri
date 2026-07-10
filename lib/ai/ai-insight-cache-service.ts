import { db } from "@/lib/prisma";
import type { AiStructuredResponse } from "@/lib/ai/ai-structured-output";
import { buildInsightCacheKey } from "@/lib/ai/ai-cache-key";
import { prepareAiInsightForCache } from "@/lib/ai/ai-display-safety";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export async function getCachedInsight<T>(
  companyId: string,
  cacheKey: string
): Promise<T | null> {
  const row = await db.aIInsightCache.findUnique({
    where: { companyId_cacheKey: { companyId, cacheKey } },
  });
  if (!row || row.expiresAt < new Date()) return null;
  return row.content as T;
}

export async function setCachedInsight(input: {
  companyId: string;
  cacheKey: string;
  content: unknown;
  provider?: string;
  model?: string;
  ttlMs?: number;
}) {
  const expiresAt = new Date(Date.now() + (input.ttlMs || DEFAULT_TTL_MS));
  return db.aIInsightCache.upsert({
    where: {
      companyId_cacheKey: {
        companyId: input.companyId,
        cacheKey: input.cacheKey,
      },
    },
    create: {
      companyId: input.companyId,
      cacheKey: input.cacheKey,
      content: input.content as object,
      provider: input.provider,
      model: input.model,
      expiresAt,
    },
    update: {
      content: input.content as object,
      provider: input.provider,
      model: input.model,
      expiresAt,
    },
  });
}

export type DashboardAiExecutiveSummary = {
  generatedAt: string;
  provider: string;
  model?: string;
  blocks: AiStructuredResponse["blocks"];
  commentary?: string;
  sourceModules?: string[];
  period?: { from: string; to: string };
  responseMode?: "openai" | "rules_fallback";
  metrics: {
    todaySales: number;
    accountBalance: number;
    lowStockCount: number;
    overdueCollection: number;
  };
};

export async function getOrBuildDashboardExecutiveSummary(input: {
  companyId: string;
  from?: Date;
  to?: Date;
  model?: string | null;
  builder: () => Promise<DashboardAiExecutiveSummary>;
  ttlMs?: number;
}) {
  const cacheKey = await buildInsightCacheKey({
    companyId: input.companyId,
    scope: "dashboard-executive-summary",
    from: input.from,
    to: input.to,
    model: input.model,
  });

  const cached = await getCachedInsight<DashboardAiExecutiveSummary>(
    input.companyId,
    cacheKey
  );
  if (cached) return cached;

  const built = await input.builder();
  const sanitizedBlocks = prepareAiInsightForCache({
    blocks: built.blocks,
    sourceModules: built.sourceModules ?? [],
  });
  if (sanitizedBlocks) {
    await setCachedInsight({
      companyId: input.companyId,
      cacheKey,
      content: { ...built, blocks: sanitizedBlocks.blocks },
      provider: built.provider,
      model: built.model || input.model || undefined,
      ttlMs: input.ttlMs,
    });
  }
  return {
    ...built,
    blocks: sanitizedBlocks?.blocks ?? built.blocks,
  };
}

export async function getModuleInsightCache<T>(
  companyId: string,
  moduleKey: string,
  options?: { from?: Date; to?: Date; model?: string | null }
) {
  const cacheKey = await buildInsightCacheKey({
    companyId,
    scope: `module-${moduleKey}`,
    from: options?.from,
    to: options?.to,
    model: options?.model,
  });
  return getCachedInsight<T>(companyId, cacheKey);
}

export async function setModuleInsightCache(
  companyId: string,
  moduleKey: string,
  content: unknown,
  options?: { from?: Date; to?: Date; model?: string | null; provider?: string }
) {
  const cacheKey = await buildInsightCacheKey({
    companyId,
    scope: `module-${moduleKey}`,
    from: options?.from,
    to: options?.to,
    model: options?.model,
  });
  return setCachedInsight({
    companyId,
    cacheKey,
    content,
    provider: options?.provider,
    model: options?.model || undefined,
  });
}
