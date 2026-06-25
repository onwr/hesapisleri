import {
  AiServiceError,
  mapOpenAiHttpStatus,
} from "@/lib/ai/ai-errors";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import type {
  AiProvider,
  AiProviderRequest,
  AiProviderResult,
  AiProviderToolCall,
} from "@/lib/ai/ai-provider";
import { parseStructuredResponse } from "@/lib/ai/ai-structured-output";
import { redactSensitiveText } from "@/lib/ai/ai-redaction";

function extractOutputText(data: Record<string, unknown>) {
  const output = data.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "message" && Array.isArray(record.content)) {
      for (const part of record.content) {
        if (
          part &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "output_text"
        ) {
          const text = String((part as Record<string, unknown>).text || "");
          if (text) chunks.push(text);
        }
      }
    }
    if (record.type === "output_text" && record.text) {
      chunks.push(String(record.text));
    }
  }
  return chunks.join("\n").trim();
}

function extractToolCalls(data: Record<string, unknown>): AiProviderToolCall[] {
  const output = data.output;
  if (!Array.isArray(output)) return [];

  const calls: AiProviderToolCall[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type === "function_call") {
      calls.push({
        id: String(record.call_id || record.id || crypto.randomUUID()),
        name: String(record.name || ""),
        arguments:
          typeof record.arguments === "string"
            ? record.arguments
            : JSON.stringify(record.arguments || {}),
      });
    }
  }
  return calls.filter((call) => call.name);
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";

  private getApiKey() {
    const apiKey = getPlatformAiConfig().apiKey;
    if (!apiKey) {
      throw new AiServiceError("API_KEY_MISSING", 503);
    }
    return apiKey;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const config = getPlatformAiConfig();
    const apiKey = this.getApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const input = request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const body: Record<string, unknown> = {
        model: request.model,
        input,
        temperature: request.temperature ?? 0.3,
        max_output_tokens: request.maxOutputTokens ?? 800,
        store: config.storeResponses,
      };

      if (request.tools?.length) {
        body.tools = request.tools.map((tool) => ({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          strict: tool.strict ?? true,
        }));
      }

      if (request.responseFormat === "json_schema" && request.jsonSchema) {
        body.text = {
          format: {
            type: "json_schema",
            name: "assistant_response",
            schema: request.jsonSchema,
            strict: true,
          },
        };
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(
          "[ai/openai] request failed",
          response.status,
          redactSensitiveText(errText.slice(0, 300))
        );
        throw new AiServiceError(mapOpenAiHttpStatus(response.status), response.status);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const message = extractOutputText(data);
      const toolCalls = extractToolCalls(data);
      const usageRaw = (data.usage || {}) as Record<string, unknown>;

      let structured = null;
      if (message) {
        try {
          structured = parseStructuredResponse(JSON.parse(message));
        } catch {
          structured = null;
        }
      }

      return {
        message: message || "Yanıt oluşturulamadı.",
        structured,
        toolCalls,
        usage: {
          promptTokens: Number(usageRaw.input_tokens || 0),
          completionTokens: Number(usageRaw.output_tokens || 0),
          totalTokens: Number(usageRaw.total_tokens || 0),
        },
        model: String(data.model || request.model),
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof AiServiceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiServiceError("TIMEOUT", 504);
      }
      console.error("[ai/openai] unexpected error", error);
      throw new AiServiceError("PROVIDER_ERROR", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection(model: string) {
    try {
      const result = await this.generate({
        model,
        messages: [
          {
            role: "user",
            content: "Bağlantı testi. Yalnızca 'OK' yaz.",
          },
        ],
        maxOutputTokens: 16,
        temperature: 0,
      });
      return result.message ? { ok: true as const } : { ok: false as const, code: "EMPTY" };
    } catch (error) {
      if (error instanceof AiServiceError) {
        return { ok: false as const, code: error.code };
      }
      return { ok: false as const, code: "PROVIDER_ERROR" };
    }
  }
}

export function createOpenAiProvider() {
  return new OpenAiProvider();
}
