import { createHash } from "node:crypto";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";

export const AI_MAX_TOOL_RESULT_BYTES = Number(
  process.env.AI_MAX_TOOL_RESULT_BYTES || 24_000
);

export class AiToolLoopGuard {
  private readonly startedAt = Date.now();
  private readonly executedKeys = new Set<string>();
  private toolCallCount = 0;

  constructor(private readonly maxToolCalls = getPlatformAiConfig().maxToolCalls) {}

  get count() {
    return this.toolCallCount;
  }

  assertWithinTimeLimit() {
    const elapsed = Date.now() - this.startedAt;
    if (elapsed > getPlatformAiConfig().requestTimeoutMs) {
      throw new AiServiceError("TIMEOUT", 504);
    }
  }

  assertCanExecuteMore() {
    this.assertWithinTimeLimit();
    if (this.toolCallCount >= this.maxToolCalls) {
      throw new AiServiceError("TOOL_LIMIT_EXCEEDED", 429);
    }
  }

  registerToolCall(name: string, argumentsJson: string) {
    this.assertCanExecuteMore();
    const key = createHash("sha256")
      .update(`${name}:${argumentsJson}`)
      .digest("hex");
    if (this.executedKeys.has(key)) {
      throw new AiServiceError("TOOL_VALIDATION_FAILED", 400);
    }
    this.executedKeys.add(key);
    this.toolCallCount += 1;
  }

  truncateToolResult(result: unknown) {
    const serialized = JSON.stringify(result);
    if (serialized.length <= AI_MAX_TOOL_RESULT_BYTES) {
      return result;
    }

    return {
      truncated: true,
      preview: serialized.slice(0, AI_MAX_TOOL_RESULT_BYTES),
      originalBytes: serialized.length,
      maxBytes: AI_MAX_TOOL_RESULT_BYTES,
    };
  }
}
