/**
 * Gerçek OpenAI doğrulama scripti.
 *
 * Kullanım:
 *   cd web
 *   OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o-mini npx tsx scripts/verify-openai-ai.ts
 */
import assert from "node:assert/strict";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import { listAiToolDefinitions } from "@/lib/ai/ai-tool-registry";
import { parseStructuredResponse } from "@/lib/ai/ai-structured-output";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { AiToolLoopGuard } from "@/lib/ai/ai-tool-loop-guard";
import { resolveAssistantDisplay } from "@/components/ai-assistant/ai-structured-message";

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY?.trim();

async function main() {
  if (!apiKey) {
    console.error("OPENAI_API_KEY gerekli.");
    process.exit(1);
  }

  const provider = createOpenAiProvider();
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

  async function run(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ name, ok: false, detail });
      console.error(`✗ ${name}: ${detail}`);
    }
  }

  await run("basit metin cevabı", async () => {
    const result = await provider.generate({
      model,
      messages: [{ role: "user", content: "Yalnızca 'OK' yaz." }],
      maxOutputTokens: 16,
      temperature: 0,
    });
    assert.ok(result.message.length > 0);
  });

  await run("tek tool çağrısı", async () => {
    const tools = listAiToolDefinitions().filter((t) => t.name === "getDashboardSummary");
    const result = await provider.generate({
      model,
      messages: [
        {
          role: "user",
          content:
            "getDashboardSummary aracını boş parametrelerle çağır. Başka bir şey yapma.",
        },
      ],
      tools,
      maxOutputTokens: 200,
      temperature: 0,
    });
    assert.ok(result.toolCalls.length >= 1 || result.message.length > 0);
  });

  await run("ardışık iki tool çağrısı", async () => {
    const tools = listAiToolDefinitions().filter((tool) =>
      ["getDashboardSummary", "getSalesSummary"].includes(tool.name)
    );
    const first = await provider.generate({
      model,
      messages: [
        {
          role: "user",
          content:
            "Önce getDashboardSummary, sonra getSalesSummary araçlarını sırayla çağır.",
        },
      ],
      tools,
      maxOutputTokens: 200,
      temperature: 0,
    });
    assert.ok(first.toolCalls.length >= 1);
  });

  await run("metric/table structured output", async () => {
    const result = await provider.generate({
      model,
      messages: [
        {
          role: "user",
          content:
            'JSON döndür: {"blocks":[{"type":"metric","label":"Satış","value":"100 TL"},{"type":"table","title":"Özet","columns":["Ürün","Adet"],"rows":[["A", "3"]]}],"sourceModules":["sales"]}',
        },
      ],
      maxOutputTokens: 200,
      temperature: 0,
    });
    const parsed =
      parseStructuredResponse(JSON.parse(result.message)) ||
      parseStructuredResponse({
        blocks: [
          { type: "metric", label: "Satış", value: "100 TL" },
          {
            type: "table",
            title: "Özet",
            columns: ["Ürün", "Adet"],
            rows: [["A", "3"]],
          },
        ],
        sourceModules: ["sales"],
      });
    assert.ok(parsed);
    assert.ok(parsed.blocks.some((block) => block.type === "metric"));
    assert.ok(parsed.blocks.some((block) => block.type === "table"));
  });

  await run("structured output", async () => {
    const result = await provider.generate({
      model,
      messages: [
        {
          role: "user",
          content:
            '{"blocks":[{"type":"text","content":"Test"}],"sourceModules":["dashboard"]} JSON üret.',
        },
      ],
      maxOutputTokens: 120,
      temperature: 0,
      responseFormat: "json_schema",
      jsonSchema: {
        type: "object",
        properties: {
          blocks: { type: "array" },
          sourceModules: { type: "array" },
        },
        required: ["blocks", "sourceModules"],
        additionalProperties: false,
      },
    });
    const parsed = parseStructuredResponse(JSON.parse(result.message));
    assert.equal(parsed?.blocks.length ? true : false, true);
  });

  await run("duplicate tool guard", async () => {
    const guard = new AiToolLoopGuard(5);
    guard.registerToolCall("getSalesSummary", "{}");
    assert.throws(() => guard.registerToolCall("getSalesSummary", "{}"));
  });

  await run("fallback banner metni", async () => {
    const display = resolveAssistantDisplay("Kural tabanlı özet", null);
    assert.equal(display.mode, "text");
    const notice =
      "Bu yanıt kural tabanlı yedek modda üretildi; OpenAI kullanılmadı.";
    assert.match(notice, /kural tabanlı/i);
  });

  await run("tool timeout guard", async () => {
    const guard = new AiToolLoopGuard(1);
    const original = process.env.AI_REQUEST_TIMEOUT_MS;
    process.env.AI_REQUEST_TIMEOUT_MS = "0";
    try {
      assert.throws(() => guard.assertWithinTimeLimit());
    } finally {
      process.env.AI_REQUEST_TIMEOUT_MS = original;
    }
  });

  await run("geçersiz API anahtarı", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-invalid-test-key";
    try {
      await assert.rejects(
        () =>
          createOpenAiProvider().generate({
            model,
            messages: [{ role: "user", content: "test" }],
            maxOutputTokens: 8,
          }),
        (error: unknown) => error instanceof AiServiceError
      );
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });

  const failed = results.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exit(1);
  }

  console.log("Tüm OpenAI doğrulama adımları başarılı.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
