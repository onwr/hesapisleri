import { AiServiceError } from "@/lib/ai/ai-errors";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import { estimateAiCostUsd } from "@/lib/ai/ai-usage-service";
import { getAiRateLimitStorage } from "@/lib/ai/ai-rate-limit-storage";

export type AiRateLimitConfig = {
  maxMessagesPerMinute: number;
  maxToolCallsPerHour: number;
  maxDailyCostUsd: number;
  maxDailyTokens: number;
};

export function getAiRateLimitConfig(): AiRateLimitConfig {
  return {
    maxMessagesPerMinute: Number(process.env.AI_MAX_MESSAGES_PER_MINUTE || 12),
    maxToolCallsPerHour: Number(process.env.AI_MAX_TOOL_CALLS_PER_HOUR || 80),
    maxDailyCostUsd: Number(process.env.AI_MAX_DAILY_COST_USD || 10),
    maxDailyTokens: Number(process.env.AI_MAX_DAILY_TOKENS || 200_000),
  };
}

export type AiRateLimitStatus = {
  messagesLastMinute: number;
  toolCallsLastHour: number;
  dailyTokens: number;
  dailyCostUsd: number;
  limits: AiRateLimitConfig;
};

export async function getAiRateLimitStatus(
  companyId: string,
  userId?: string
): Promise<AiRateLimitStatus> {
  const limits = getAiRateLimitConfig();
  const storage = getAiRateLimitStorage();

  const [messagesLastMinute, toolCallsLastHour, dailyUsage] = await Promise.all([
    userId ? storage.countMessagesLastMinute(companyId, userId) : Promise.resolve(0),
    storage.countToolCallsLastHour(companyId),
    storage.getDailyUsage(companyId),
  ]);

  return {
    messagesLastMinute,
    toolCallsLastHour,
    dailyTokens: dailyUsage.dailyTokens,
    dailyCostUsd: dailyUsage.dailyCostUsd,
    limits,
  };
}

export async function assertAiChatRateLimits(companyId: string, userId: string) {
  const status = await getAiRateLimitStatus(companyId, userId);
  const { limits } = status;

  if (status.messagesLastMinute >= limits.maxMessagesPerMinute) {
    throw new AiServiceError("RATE_LIMITED", 429);
  }

  if (status.dailyTokens >= limits.maxDailyTokens) {
    throw new AiServiceError("RATE_LIMITED", 429);
  }

  if (status.dailyCostUsd >= limits.maxDailyCostUsd) {
    throw new AiServiceError("RATE_LIMITED", 429);
  }
}

export async function assertAiToolRateLimit(companyId: string) {
  const limits = getAiRateLimitConfig();
  const storage = getAiRateLimitStorage();
  const toolCallsLastHour = await storage.countToolCallsLastHour(companyId);

  if (toolCallsLastHour >= limits.maxToolCallsPerHour) {
    throw new AiServiceError("RATE_LIMITED", 429);
  }
}

export function estimateRequestCost(model: string, promptTokens: number, completionTokens: number) {
  return estimateAiCostUsd(model, promptTokens, completionTokens);
}

export function getPlatformRequestTimeoutMs() {
  return Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000);
}
