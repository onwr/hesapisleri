import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { WRITE_ACTION_TOOL_NAMES } from "@/lib/ai/ai-config";
import { AI_PROMPT_VERSION } from "@/lib/ai/ai-cache-key";
import {
  PROVIDER_STATUS_LABELS,
  resolveAiProviderStatus,
} from "@/lib/ai/ai-provider-status";
import {
  assertRegistryHasNoWriteTools,
  getRegisteredToolNames,
  listAiToolDefinitions,
} from "@/lib/ai/ai-tool-registry";
import { AiToolLoopGuard } from "@/lib/ai/ai-tool-loop-guard";
import { getAiRateLimitConfig } from "@/lib/ai/ai-rate-limit-service";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("AI Faz 1.1 production readiness", () => {
  it("AI migration dosyası mevcut ve tüm tabloları içerir", () => {
    const migrationPath = join(
      webRoot,
      "prisma/migrations/20260628120000_ai_phase1_models/migration.sql"
    );
    assert.equal(existsSync(migrationPath), true);
    const sql = readFileSync(migrationPath, "utf8");
    for (const table of [
      "CompanyAISettings",
      "AIConversation",
      "AIMessage",
      "AIUsageLog",
      "AIToolExecution",
      "AIInsightCache",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
    }
  });

  it("provider durumları ayrık enum değerleriyle tanımlı", () => {
    for (const status of [
      "OPENAI_ACTIVE",
      "RULE_BASED_FALLBACK",
      "DISABLED",
      "MISSING_API_KEY",
      "INVALID_API_KEY",
      "RATE_LIMITED",
      "PROVIDER_UNAVAILABLE",
    ]) {
      assert.ok(PROVIDER_STATUS_LABELS[status as keyof typeof PROVIDER_STATUS_LABELS]);
    }
  });

  it("OpenAI yapılandırılmışken INVALID_API_KEY fallback kullanmaz", () => {
    const report = resolveAiProviderStatus({
      companyEnabled: true,
      companyProvider: "openai",
      model: "gpt-4o-mini",
      connectionErrorCode: "UNAUTHORIZED_KEY",
    });
    assert.equal(report.status, "INVALID_API_KEY");
    assert.equal(report.usesRulesFallback, false);
    assert.equal(report.canChat, false);
  });

  it("yazma araçları registry'de kayıtlı değil", () => {
    assertRegistryHasNoWriteTools(WRITE_ACTION_TOOL_NAMES);
    const registered = new Set(getRegisteredToolNames());
    for (const writeName of WRITE_ACTION_TOOL_NAMES) {
      assert.equal(registered.has(writeName as never), false);
    }
  });

  it("tool loop guard tekrar eden çağrıyı reddeder", () => {
    const guard = new AiToolLoopGuard(5);
    guard.registerToolCall("getSalesSummary", "{}");
    assert.throws(
      () => guard.registerToolCall("getSalesSummary", "{}"),
      /geçersiz|Araç/i
    );
  });

  it("tool loop guard sonuç boyutunu sınırlar", () => {
    const guard = new AiToolLoopGuard(5);
    const huge = { data: "x".repeat(50_000) };
    const truncated = guard.truncateToolResult(huge) as {
      truncated?: boolean;
    };
    assert.equal(truncated.truncated, true);
  });

  it("cache anahtarı prompt version içerir", () => {
    assert.equal(AI_PROMPT_VERSION, "1.1.0");
    const cache = read("lib/ai/ai-cache-key.ts");
    assert.match(cache, /companyId/);
    assert.match(cache, /AI_PROMPT_VERSION/);
    assert.match(cache, /getCompanyDataRevisionHash/);
  });

  it("chat servisi fallback modunu açıkça döner", () => {
    const chat = read("lib/ai/ai-chat-service.ts");
    assert.match(chat, /responseMode/);
    assert.match(chat, /fallbackNotice/);
    assert.match(chat, /shouldUseRulesFallback/);
    assert.doesNotMatch(chat, /health\.usesRulesFallback \|\| health\.status === "rules_fallback"/);
  });

  it("rate limit yapılandırması tanımlı", () => {
    const config = getAiRateLimitConfig();
    assert.ok(config.maxMessagesPerMinute > 0);
    assert.ok(config.maxToolCallsPerHour > 0);
    assert.ok(config.maxDailyCostUsd > 0);
    assert.ok(config.maxDailyTokens > 0);
  });

  it("maliyet uyarısı servisi bildirim üretir", () => {
    const service = read("lib/ai/ai-cost-alert-service.ts");
    assert.match(service, /createNotification/);
    assert.match(service, /autoDisableOnCostExceeded/);
  });

  it("17 read-only tool kayıtlı", () => {
    assert.equal(listAiToolDefinitions().length, 17);
  });
});
