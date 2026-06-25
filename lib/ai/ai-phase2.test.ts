import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { groupConversationsByDate } from "@/lib/ai/ai-conversation-service";
import { resolveAssistantDisplay } from "@/components/ai-assistant/ai-structured-message";
import { getAiRateLimitStorage } from "@/lib/ai/ai-rate-limit-storage";
import { WRITE_ACTION_TOOL_NAMES } from "@/lib/ai/ai-config";
import { assertRegistryHasNoWriteTools } from "@/lib/ai/ai-tool-registry";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("AI Faz 2", () => {
  it("konuşma geçmişi API ve UI dosyaları mevcut", () => {
    assert.match(read("app/api/ai/conversations/[id]/route.ts"), /PATCH/);
    assert.match(read("app/api/ai/conversations/[id]/route.ts"), /DELETE/);
    assert.match(read("components/ai-assistant/ai-conversation-sidebar.tsx"), /groupConversationsByDate/);
    assert.match(read("components/ai-assistant/ai-assistant-chat-panel.tsx"), /AiConversationSidebar/);
  });

  it("konuşmalar tarih gruplarına ayrılır", () => {
    const now = new Date();
    const groups = groupConversationsByDate([
      {
        id: "1",
        title: "Bugün",
        provider: null,
        model: null,
        updatedAt: now,
        preview: "test",
      },
    ]);
    assert.equal(groups[0]?.label, "Bugün");
  });

  it("structured output fallback düz metin gösterir", () => {
    const display = resolveAssistantDisplay("Merhaba", { invalid: true });
    assert.equal(display.mode, "text");
    if (display.mode === "text") {
      assert.equal(display.content, "Merhaba");
    }
  });

  it("ham JSON kullanıcıya gösterilmez", () => {
    const raw = '{"blocks":[{"type":"text","content":"Özet"}],"sourceModules":["sales"]}';
    const display = resolveAssistantDisplay(raw);
    assert.equal(display.mode, "structured");
  });

  it("admin stats endpoint ve panel mevcut", () => {
    assert.match(read("app/api/ai/admin/stats/route.ts"), /aiAdminStatsHandler/);
    assert.match(read("components/settings/ai-admin-usage-panel.tsx"), /AI Kullanım ve Maliyet/);
    assert.match(read("app/settings/ai/usage/page.tsx"), /canViewAiUsageStats/);
  });

  it("modül insight LLM commentary servisi mevcut", () => {
    const service = read("lib/ai/ai-insight-commentary-service.ts");
    assert.match(service, /generateModuleInsightCommentary/);
    assert.match(service, /createOpenAiProvider/);
    assert.match(read("components/ai-assistant/ai-module-insight-card.tsx"), /AiStructuredMessage/);
  });

  it("rate limit storage interface DB implementasyonu sağlar", () => {
    const storage = getAiRateLimitStorage();
    assert.equal(typeof storage.countMessagesLastMinute, "function");
    assert.equal(typeof storage.countToolCallsLastHour, "function");
    assert.equal(typeof storage.getDailyUsage, "function");
  });

  it("yazma araçları hâlâ registry dışında", () => {
    assertRegistryHasNoWriteTools(WRITE_ACTION_TOOL_NAMES);
  });

  it("structured render bileşenleri action proposal uyarısı içerir", () => {
    const component = read("components/ai-assistant/ai-structured-message.tsx");
    assert.match(component, /action_proposal/);
    assert.match(component, /Yalnızca öneri/);
    assert.match(component, /chart_suggestion/);
    assert.match(component, /metric/);
    assert.match(component, /table/);
  });
});
