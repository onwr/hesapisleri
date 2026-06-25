import { z } from "zod";

export const aiTextBlockSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
});

export const aiMetricBlockSchema = z.object({
  type: z.literal("metric"),
  label: z.string(),
  value: z.string(),
  trend: z.string().optional(),
});

export const aiTableBlockSchema = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const aiChartSuggestionBlockSchema = z.object({
  type: z.literal("chart_suggestion"),
  chartType: z.enum(["line", "bar", "pie"]),
  title: z.string(),
  description: z.string(),
});

export const aiWarningBlockSchema = z.object({
  type: z.literal("warning"),
  title: z.string(),
  message: z.string(),
});

export const aiActionProposalBlockSchema = z.object({
  type: z.literal("action_proposal"),
  title: z.string(),
  description: z.string(),
  module: z.string().optional(),
  requiresApproval: z.boolean().default(true),
  href: z.string().optional(),
});

export const aiResponseBlockSchema = z.discriminatedUnion("type", [
  aiTextBlockSchema,
  aiMetricBlockSchema,
  aiTableBlockSchema,
  aiChartSuggestionBlockSchema,
  aiWarningBlockSchema,
  aiActionProposalBlockSchema,
]);

export const aiStructuredResponseSchema = z.object({
  blocks: z.array(aiResponseBlockSchema).min(1),
  sourceModules: z.array(z.string()).default([]),
});

export type AiStructuredResponse = z.infer<typeof aiStructuredResponseSchema>;
export type AiResponseBlock = z.infer<typeof aiResponseBlockSchema>;

export const AI_STRUCTURED_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    blocks: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["text"] },
              content: { type: "string" },
            },
            required: ["type", "content"],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["metric"] },
              label: { type: "string" },
              value: { type: "string" },
              trend: { type: "string" },
            },
            required: ["type", "label", "value"],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["warning"] },
              title: { type: "string" },
              message: { type: "string" },
            },
            required: ["type", "title", "message"],
          },
        ],
      },
    },
    sourceModules: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["blocks"],
} as const;

export function textResponse(content: string, sourceModules: string[] = []): AiStructuredResponse {
  return {
    blocks: [{ type: "text", content }],
    sourceModules,
  };
}

export function parseStructuredResponse(raw: unknown): AiStructuredResponse | null {
  const parsed = aiStructuredResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
