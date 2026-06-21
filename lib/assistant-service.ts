import { z } from "zod";
import { getAiAssistantPageData } from "@/lib/ai-assistant-page-data";
import {
  generateAiAnswer,
  normalizeDateRange,
  parseDateParam,
  type AiAssistantContext,
} from "@/lib/ai-assistant-page-utils";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";

export const ASSISTANT_MESSAGE_MAX_LENGTH = 2000;

export const assistantChatBodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Lütfen bir mesaj yazın.")
    .max(
      ASSISTANT_MESSAGE_MAX_LENGTH,
      `Mesaj en fazla ${ASSISTANT_MESSAGE_MAX_LENGTH} karakter olabilir.`
    ),
  context: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AssistantProviderMode = "openai" | "rules" | "missing";

export class AssistantConfigError extends Error {
  constructor() {
    super(
      "Yapay zeka servisi yapılandırılmamış. Lütfen API anahtarını kontrol edin."
    );
    this.name = "AssistantConfigError";
  }
}

export function getAssistantProviderMode(): AssistantProviderMode {
  const provider = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (provider === "rules") return "rules";
  if (provider === "openai") return hasKey ? "openai" : "missing";
  return hasKey ? "openai" : "rules";
}

export function buildSafeContextSummary(context: AiAssistantContext) {
  return {
    period: context.periodLabel,
    totalSales: context.totalSales,
    totalExpenses: context.totalExpenses,
    profit: context.profit,
    cashIncome: context.cashIncome,
    salesCount: context.salesCount,
    expensesCount: context.expensesCount,
    accountBalance: context.accountBalance,
    unpaidInvoiceTotal: context.unpaidInvoiceTotal,
    unpaidInvoiceCount: context.unpaidInvoiceCount,
    lowStockCount: context.lowStockCount,
    outOfStockCount: context.outOfStockCount,
    riskScore: context.riskScore,
    riskLevel: context.riskLevel,
    topProductName: context.topProductName,
    topCustomerName: context.topCustomerName,
    topExpenseCategory: context.topExpenseCategory,
  };
}

export function buildOpenAiSystemPrompt(
  summary: ReturnType<typeof buildSafeContextSummary>,
  topic?: string
) {
  return [
    "Sen Hesapisleri.com için Türkçe konuşan bir finans asistanısın.",
    "Yanıtlarını yalnızca aşağıdaki özet işletme verilerine dayandır.",
    "Veri yoksa bunu açıkça belirt; tahmin yapma.",
    `Odak alanı: ${topic || "genel"}`,
    "",
    "İşletme özeti (JSON):",
    JSON.stringify(summary),
  ].join("\n");
}

export async function callOpenAiChat(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AssistantConfigError();
  }

  const model =
    process.env.OPENAI_MODEL?.trim() ||
    process.env.AI_MODEL?.trim() ||
    "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error(
      "[assistant/chat] OpenAI error",
      response.status,
      errText.slice(0, 200)
    );
    throw new Error("OPENAI_REQUEST_FAILED");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  return content;
}

export async function generateAssistantReply(
  message: string,
  context: AiAssistantContext,
  options?: { topic?: string }
): Promise<{ message: string; provider: "openai" | "rules" }> {
  const mode = getAssistantProviderMode();

  if (mode === "missing") {
    throw new AssistantConfigError();
  }

  if (mode === "openai") {
    try {
      const summary = buildSafeContextSummary(context);
      const systemPrompt = buildOpenAiSystemPrompt(summary, options?.topic);
      const answer = await callOpenAiChat(systemPrompt, message);
      return { message: answer, provider: "openai" };
    } catch (error) {
      if (error instanceof AssistantConfigError) {
        throw error;
      }
      console.error("[assistant/chat] provider fallback", error);
      return {
        message: generateAiAnswer(message, context),
        provider: "rules",
      };
    }
  }

  return {
    message: generateAiAnswer(message, context),
    provider: "rules",
  };
}

export function resolveAssistantDateRange(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const parsedFrom = from ? parseDateParam(from) : defaultFrom;
  const parsedTo = to ? parseDateParam(to) : defaultTo;
  return normalizeDateRange(parsedFrom || defaultFrom, parsedTo || defaultTo);
}

export async function loadAssistantContext(
  companyId: string,
  options: { from: Date; to: Date; userName?: string }
): Promise<AiAssistantContext> {
  const data = await getAiAssistantPageData(companyId, {
    from: options.from,
    to: options.to,
    userName: options.userName || "Kullanıcı",
  });
  return data.context;
}
