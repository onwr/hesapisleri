import { db } from "@/lib/prisma";

export type AiDailyUsageSnapshot = {
  dailyTokens: number;
  dailyCostUsd: number;
};

export interface AiRateLimitStorage {
  countMessagesLastMinute(companyId: string, userId: string): Promise<number>;
  countToolCallsLastHour(companyId: string): Promise<number>;
  getDailyUsage(companyId: string): Promise<AiDailyUsageSnapshot>;
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export class DbAiRateLimitStorage implements AiRateLimitStorage {
  async countMessagesLastMinute(companyId: string, userId: string) {
    const minuteAgo = new Date(Date.now() - 60_000);
    return db.aIUsageLog.count({
      where: {
        companyId,
        userId,
        createdAt: { gte: minuteAgo },
        success: true,
      },
    });
  }

  async countToolCallsLastHour(companyId: string) {
    const hourAgo = new Date(Date.now() - 3_600_000);
    return db.aIToolExecution.count({
      where: {
        conversation: { companyId },
        createdAt: { gte: hourAgo },
        success: true,
      },
    });
  }

  async getDailyUsage(companyId: string) {
    const dayStart = startOfDay();
    const logs = await db.aIUsageLog.findMany({
      where: { companyId, createdAt: { gte: dayStart }, success: true },
      select: { totalTokens: true, estimatedCostUsd: true },
    });
    const dailyTokens = logs.reduce((sum, row) => sum + row.totalTokens, 0);
    const dailyCostUsd = logs.reduce(
      (sum, row) => sum + Number(row.estimatedCostUsd || 0),
      0
    );
    return {
      dailyTokens,
      dailyCostUsd: Math.round(dailyCostUsd * 1_000_000) / 1_000_000,
    };
  }
}

/** Redis yapılandırılmamışsa DB storage kullanılır. */
export function createAiRateLimitStorage(): AiRateLimitStorage {
  if (process.env.AI_RATE_LIMIT_REDIS_URL?.trim()) {
    // Faz 2: Redis adapter burada bağlanabilir; şimdilik DB fallback.
  }
  return new DbAiRateLimitStorage();
}

let storageSingleton: AiRateLimitStorage | null = null;

export function getAiRateLimitStorage() {
  if (!storageSingleton) {
    storageSingleton = createAiRateLimitStorage();
  }
  return storageSingleton;
}
