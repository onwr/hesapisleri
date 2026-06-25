import type { AiStructuredResponse } from "@/lib/ai/ai-structured-output";

export type AiProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiProviderToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

export type AiProviderToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type AiProviderRequest = {
  model: string;
  messages: AiProviderMessage[];
  tools?: AiProviderToolDefinition[];
  responseFormat?: "text" | "json_schema";
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
};

export type AiProviderResult = {
  message: string;
  structured?: AiStructuredResponse | null;
  toolCalls: AiProviderToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
};

export interface AiProvider {
  readonly name: string;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
  testConnection(model: string): Promise<{ ok: true } | { ok: false; code: string }>;
}
