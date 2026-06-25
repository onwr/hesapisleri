import { db } from "@/lib/prisma";
import { getMonthlyCostAlertStatus } from "@/lib/ai/ai-cost-alert-service";
import { getAiRateLimitStatus } from "@/lib/ai/ai-rate-limit-service";

export async function getAiAdminStats(companyId: string, userId?: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const logs = await db.aIUsageLog.findMany({
    where: { companyId, createdAt: { gte: monthStart } },
    select: {
      userId: true,
      totalTokens: true,
      estimatedCostUsd: true,
      success: true,
      errorCode: true,
      toolNames: true,
      createdAt: true,
    },
  });

  const totalRequests = logs.length;
  const failedRequests = logs.filter((log) => !log.success).length;
  const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
  const estimatedCostUsd = logs.reduce(
    (sum, log) => sum + Number(log.estimatedCostUsd || 0),
    0
  );
  const errorRate =
    totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 1000) / 10 : 0;

  const toolCounts = new Map<string, number>();
  for (const log of logs) {
    for (const tool of log.toolNames) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }
  }

  const byUser = new Map<
    string,
    { requests: number; tokens: number; costUsd: number; errors: number }
  >();
  for (const log of logs) {
    const current = byUser.get(log.userId) || {
      requests: 0,
      tokens: 0,
      costUsd: 0,
      errors: 0,
    };
    current.requests += 1;
    current.tokens += log.totalTokens;
    current.costUsd += Number(log.estimatedCostUsd || 0);
    if (!log.success) current.errors += 1;
    byUser.set(log.userId, current);
  }

  const userIds = [...byUser.keys()];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));

  const rateLimitEvents = logs.filter((log) => log.errorCode === "RATE_LIMITED").length;
  const [costAlert, rateLimits] = await Promise.all([
    getMonthlyCostAlertStatus(companyId),
    getAiRateLimitStatus(companyId, userId),
  ]);

  return {
    totalRequests,
    failedRequests,
    errorRate,
    totalTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    topTools: [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    byUser: [...byUser.entries()]
      .map(([id, stats]) => ({
        userId: id,
        name: userMap.get(id)?.name || "Kullanıcı",
        email: userMap.get(id)?.email || "",
        ...stats,
        costUsd: Math.round(stats.costUsd * 1_000_000) / 1_000_000,
      }))
      .sort((a, b) => b.requests - a.requests),
    rateLimitEvents,
    costAlert,
    rateLimits,
  };
}
