import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { WRITE_ACTION_TOOL_NAMES } from "@/lib/ai/ai-config";
import { getAiUserMessage } from "@/lib/ai/ai-errors";
import { listAiToolDefinitions, isAllowedAiToolName } from "@/lib/ai/ai-tool-registry";
import { assertToolPermission } from "@/lib/ai/ai-permission-service";
import { redactSensitiveText } from "@/lib/ai/ai-redaction";
import { aiStructuredResponseSchema } from "@/lib/ai/ai-structured-output";
import { AI_READ_TOOL_SCHEMAS } from "@/lib/ai/ai-read-tools";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("AI phase 1 architecture", () => {
  it("lib/ai core dosyaları mevcut", () => {
    const files = [
      "lib/ai/ai-provider.ts",
      "lib/ai/openai-provider.ts",
      "lib/ai/ai-config.ts",
      "lib/ai/ai-errors.ts",
      "lib/ai/ai-usage-service.ts",
      "lib/ai/ai-permission-service.ts",
      "lib/ai/ai-tool-registry.ts",
      "lib/ai/ai-context-builder.ts",
      "lib/ai/ai-chat-service.ts",
      "lib/ai/ai-health-service.ts",
      "lib/ai/ai-insight-cache-service.ts",
    ];
    for (const file of files) {
      assert.ok(read(file).length > 0, `${file} bulunamadı`);
    }
  });

  it("OpenAI provider Responses API ve store:false kullanır", () => {
    const provider = read("lib/ai/openai-provider.ts");
    assert.match(provider, /\/v1\/responses/);
    assert.match(provider, /store: config\.storeResponses/);
    assert.doesNotMatch(provider, /NEXT_PUBLIC_/);
  });

  it("17 salt-okunur araç kayıtlı", () => {
    const tools = listAiToolDefinitions();
    assert.equal(tools.length, 17);
    assert.equal(Object.keys(AI_READ_TOOL_SCHEMAS).length, 17);
    for (const tool of tools) {
      assert.equal(isAllowedAiToolName(tool.name), true);
    }
  });

  it("yazma araçları engellenir", () => {
    for (const name of WRITE_ACTION_TOOL_NAMES) {
      assert.throws(
        () =>
          assertToolPermission(name, {
            companyId: "c1",
            userId: "u1",
            effectiveRole: "OWNER",
            isOwner: true,
            readOnlyMode: true,
          }),
        /okuma/i
      );
    }
  });

  it("STAFF çalışan ödeme aracına erişemez", () => {
    assert.throws(
      () =>
        assertToolPermission("getEmployeePaymentSummary", {
          companyId: "c1",
          userId: "u1",
          effectiveRole: "STAFF",
          isOwner: false,
          readOnlyMode: true,
        }),
      /erişim/i
    );
  });

  it("tool parametrelerinde companyId reddedilir", async () => {
    const registry = read("lib/ai/ai-tool-registry.ts");
    assert.match(registry, /companyId/);
    assert.match(registry, /TENANT_MISMATCH/);
  });

  it("structured output şeması doğrular", () => {
    const parsed = aiStructuredResponseSchema.safeParse({
      blocks: [{ type: "text", content: "Merhaba" }],
      sourceModules: ["sales"],
    });
    assert.equal(parsed.success, true);
  });

  it("hassas veri redaction çalışır", () => {
    const redacted = redactSensitiveText("Anahtar: sk-abcdefghijklmnopqrstuvwxyz");
    assert.doesNotMatch(redacted, /sk-/);
    assert.match(redacted, /REDACTED_KEY/);
  });

  it("health servisi ayrı durum kodları tanımlar", () => {
    const health = read("lib/ai/ai-health-service.ts");
    const status = read("lib/ai/ai-provider-status.ts");
    assert.match(status, /OPENAI_ACTIVE/);
    assert.match(status, /RULE_BASED_FALLBACK/);
    assert.match(status, /MISSING_API_KEY/);
    assert.match(status, /INVALID_API_KEY/);
    assert.match(status, /RATE_LIMITED/);
    assert.match(status, /PROVIDER_UNAVAILABLE/);
    assert.match(health, /buildAiHealthReport/);
  });

  it("kullanıcıya Türkçe hata mesajı döner", () => {
    assert.match(getAiUserMessage("RATE_LIMITED"), /limit/i);
    assert.doesNotMatch(getAiUserMessage("RATE_LIMITED"), /OpenAI/i);
  });

  it("AI API route'ları mevcut", () => {
    assert.match(read("app/api/ai/health/route.ts"), /aiHealthHandler/);
    assert.match(read("app/api/ai/chat/route.ts"), /aiChatHandler/);
    assert.match(read("app/api/ai/settings/route.ts"), /aiSettingsGetHandler/);
    assert.match(read("app/api/ai/insights/dashboard/route.ts"), /aiDashboardInsightHandler/);
  });

  it("chat panel yeni AI endpoint kullanır", () => {
    const panel = read("components/ai-assistant/ai-assistant-chat-panel.tsx");
    assert.match(panel, /\/api\/ai\/chat/);
    assert.match(panel, /conversationId/);
    assert.match(panel, /AiHealthBadge/);
  });

  it("dashboard executive summary cache endpoint kullanır", () => {
    const component = read("components/dashboard/dashboard-ai-executive-summary.tsx");
    assert.match(component, /\/api\/ai\/insights\/dashboard/);
  });

  it("prisma AI modelleri tanımlı", () => {
    const schema = read("prisma/schema.prisma");
    assert.match(schema, /model AIConversation/);
    assert.match(schema, /model AIMessage/);
    assert.match(schema, /model AIUsageLog/);
    assert.match(schema, /model AIToolExecution/);
    assert.match(schema, /model AIInsightCache/);
    assert.match(schema, /model CompanyAISettings/);
  });
});
