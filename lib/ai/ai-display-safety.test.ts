import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  prepareAiInsightForCache,
  sanitizeActionHref,
  sanitizeStructuredAiResponse,
  stripUnsafeAiDisplayText,
} from "./ai-display-safety";

describe("ai-display-safety", () => {
  it("tailwind ve className metinlerini temizler", () => {
    const cleaned = stripUnsafeAiDisplayText(
      "Durum bg-red-500 text-sm className önemli"
    );
    assert.ok(!cleaned.includes("bg-red-500"));
    assert.ok(!cleaned.includes("text-sm"));
    assert.ok(!cleaned.includes("className"));
  });

  it("script ve ham json fallback üretir", () => {
    const cleaned = stripUnsafeAiDisplayText('<script>alert(1)</script>');
    assert.ok(!cleaned.includes("<script>"));

    const jsonFallback = stripUnsafeAiDisplayText('{"className":"bg-red-500"}');
    assert.match(jsonFallback, /güvenli biçimde gösterilemedi/i);
  });

  it("structured yanıtta güvensiz içerik sanitize edilir", () => {
    const sanitized = sanitizeStructuredAiResponse({
      blocks: [{ type: "text", content: "bg-blue-500 sonuç" }],
      sourceModules: ["dashboard"],
    });
    assert.ok(sanitized);
    const block = sanitized!.blocks[0];
    assert.equal(block?.type, "text");
    if (block?.type === "text") {
      assert.ok(!block.content.includes("bg-blue-500"));
    }
  });

  it("action href yalnızca iç yolları kabul eder", () => {
    assert.equal(sanitizeActionHref("/invoices"), "/invoices");
    assert.equal(sanitizeActionHref("javascript:alert(1)"), undefined);
  });

  it("prepareAiInsightForCache boş blokları reddeder", () => {
    assert.equal(
      prepareAiInsightForCache({
        blocks: [{ type: "text", content: "   " }],
        sourceModules: [],
      }),
      null
    );
  });
});
