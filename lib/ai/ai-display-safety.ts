import type { AiStructuredResponse, AiResponseBlock } from "@/lib/ai/ai-structured-output";

export type AiInsightSeverity = "LOW" | "MEDIUM" | "HIGH";

export const AI_INSIGHT_SEVERITY_STYLES: Record<
  AiInsightSeverity,
  { badgeClassName: string; iconClassName: string }
> = {
  LOW: {
    badgeClassName: "bg-emerald-100 text-emerald-700",
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  MEDIUM: {
    badgeClassName: "bg-orange-100 text-orange-700",
    iconClassName: "bg-orange-50 text-orange-500",
  },
  HIGH: {
    badgeClassName: "bg-rose-100 text-rose-700",
    iconClassName: "bg-rose-50 text-rose-500",
  },
};

const STRIPPED_MODEL_KEYS = new Set([
  "className",
  "class",
  "color",
  "html",
  "style",
  "tailwind",
]);

const TAILWIND_TOKEN =
  /\b(?:bg|text|border|ring|from|to|via)-[a-z0-9]+(?:\/[0-9]{1,3})?\b/gi;
const SCRIPT_TAG = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const HTML_TAG = /<[^>]+>/g;
const UNSAFE_HREF_PATTERN = /^(javascript:|data:)/i;

export function sanitizeActionHref(href?: string | null): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (UNSAFE_HREF_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

export function prepareAiInsightForCache(
  response: AiStructuredResponse
): AiStructuredResponse | null {
  return sanitizeStructuredAiResponse(response);
}

export function stripUnsafeAiDisplayText(value: string): string {
  let next = value.trim();
  if (!next) return "";

  if (next.startsWith("{") || next.startsWith("[")) {
    try {
      const parsed = JSON.parse(next) as unknown;
      if (parsed && typeof parsed === "object") {
        return "Yanıt güvenli biçimde gösterilemedi. Lütfen sorunuzu yeniden deneyin.";
      }
    } catch {
      // keep plain text fallback
    }
  }

  next = next.replace(SCRIPT_TAG, "");
  next = next.replace(HTML_TAG, "");
  next = next.replace(TAILWIND_TOKEN, "");
  next = next.replace(/\bclassName\b/gi, "");

  return next.trim();
}

function sanitizeBlock(block: AiResponseBlock): AiResponseBlock | null {
  if (block.type === "text") {
    const content = stripUnsafeAiDisplayText(block.content);
    if (!content) return null;
    return { ...block, content };
  }

  if (block.type === "metric") {
    return {
      ...block,
      label: stripUnsafeAiDisplayText(block.label),
      value: stripUnsafeAiDisplayText(block.value),
      trend: block.trend ? stripUnsafeAiDisplayText(block.trend) : undefined,
    };
  }

  if (block.type === "warning") {
    return {
      ...block,
      title: stripUnsafeAiDisplayText(block.title),
      message: stripUnsafeAiDisplayText(block.message),
    };
  }

  if (block.type === "action_proposal") {
    return {
      ...block,
      title: stripUnsafeAiDisplayText(block.title),
      description: stripUnsafeAiDisplayText(block.description),
      href: sanitizeActionHref(block.href),
    };
  }

  if (block.type === "chart_suggestion") {
    return {
      ...block,
      title: stripUnsafeAiDisplayText(block.title),
      description: stripUnsafeAiDisplayText(block.description),
    };
  }

  if (block.type === "table") {
    return {
      ...block,
      title: block.title ? stripUnsafeAiDisplayText(block.title) : undefined,
      columns: block.columns.map((column) => stripUnsafeAiDisplayText(column)),
      rows: block.rows.map((row) =>
        row.map((cell) => stripUnsafeAiDisplayText(cell))
      ),
    };
  }

  return block;
}

export function sanitizeStructuredAiResponse(
  response: AiStructuredResponse
): AiStructuredResponse | null {
  const blocks = response.blocks
    .map(sanitizeBlock)
    .filter((block): block is AiResponseBlock => Boolean(block));

  if (!blocks.length) return null;

  return {
    blocks,
    sourceModules: response.sourceModules.filter(
      (module) => !STRIPPED_MODEL_KEYS.has(module)
    ),
  };
}

export function sanitizeUnknownStructuredPayload(
  raw: unknown
): AiStructuredResponse | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  for (const key of STRIPPED_MODEL_KEYS) {
    if (key in candidate) {
      delete candidate[key];
    }
  }

  if (!Array.isArray(candidate.blocks)) return null;
  return sanitizeStructuredAiResponse({
    blocks: candidate.blocks as AiStructuredResponse["blocks"],
    sourceModules: Array.isArray(candidate.sourceModules)
      ? (candidate.sourceModules as string[])
      : [],
  });
}
