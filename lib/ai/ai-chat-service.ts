import { db } from "@/lib/prisma";
import { generateAiAnswer } from "@/lib/ai-assistant-page-utils";
import { loadAssistantContext } from "@/lib/assistant-service";
import { getPlatformAiConfig, resolveEffectiveModel } from "@/lib/ai/ai-config";
import {
  buildAiRuntimeContext,
  buildSystemPrompt,
} from "@/lib/ai/ai-context-builder";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { buildAiHealthReport } from "@/lib/ai/ai-health-service";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import {
  textResponse,
  type AiStructuredResponse,
} from "@/lib/ai/ai-structured-output";
import { executeAiTool, listAiToolDefinitions } from "@/lib/ai/ai-tool-registry";
import { AiToolLoopGuard } from "@/lib/ai/ai-tool-loop-guard";
import { getCompanyAiSettingsView } from "@/lib/ai/ai-settings-service";
import {
  logAiUsage,
  logToolExecution,
} from "@/lib/ai/ai-usage-service";
import { assertAiChatRateLimits } from "@/lib/ai/ai-rate-limit-service";
import { shouldUseRulesFallback } from "@/lib/ai/ai-provider-status";
import type { PermissionRole } from "@/lib/permission-utils";

export type AiChatInput = {
  companyId: string;
  userId: string;
  userName: string;
  effectiveRole: PermissionRole;
  isOwner: boolean;
  message: string;
  conversationId?: string | null;
  from?: Date;
  to?: Date;
  topic?: string;
};

export type AiChatResult = {
  conversationId: string;
  message: string;
  structured: AiStructuredResponse | null;
  provider: string;
  model: string;
  toolNames: string[];
  responseMode: "openai" | "rules_fallback";
  fallbackNotice?: string | null;
};

export async function runAiChat(input: AiChatInput): Promise<AiChatResult> {
  const started = Date.now();
  await assertAiChatRateLimits(input.companyId, input.userId);

  const health = await buildAiHealthReport(input.companyId);
  if (!health.canChat && !health.usesRulesFallback) {
    throw new AiServiceError(
      health.status === "RATE_LIMITED" ? "RATE_LIMITED" : "AI_DISABLED",
      health.status === "RATE_LIMITED" ? 429 : 503
    );
  }

  const settings = await getCompanyAiSettingsView(input.companyId);
  const runtime = await buildAiRuntimeContext({
    companyId: input.companyId,
    userId: input.userId,
    userName: input.userName,
    effectiveRole: input.effectiveRole,
    isOwner: input.isOwner,
    readOnlyMode: settings.readOnlyMode,
    from: input.from,
    to: input.to,
    topic: input.topic,
  });

  const conversation = input.conversationId
    ? await db.aIConversation.findFirst({
        where: {
          id: input.conversationId,
          companyId: input.companyId,
          userId: input.userId,
        },
      })
    : null;

  if (input.conversationId && !conversation) {
    throw new AiServiceError("CONVERSATION_NOT_FOUND", 404);
  }

  const activeConversation =
    conversation ||
    (await db.aIConversation.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        title: input.message.slice(0, 80),
      },
    }));

  await db.aIMessage.create({
    data: {
      conversationId: activeConversation.id,
      role: "user",
      content: input.message,
    },
  });

  const history = await db.aIMessage.findMany({
    where: { conversationId: activeConversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  if (shouldUseRulesFallback(health.status)) {
    const legacyContext = await loadAssistantContext(input.companyId, {
      from: runtime.from,
      to: runtime.to,
      userName: input.userName,
    });
    const answer = generateAiAnswer(input.message, legacyContext);
    const fallbackNotice =
      health.status === "RULE_BASED_FALLBACK" || health.status === "MISSING_API_KEY"
        ? "Bu yanıt kural tabanlı yedek modda üretildi; OpenAI kullanılmadı."
        : health.status === "DISABLED"
          ? "Yapay zekâ kapalı olduğu için kural tabanlı yedek mod kullanıldı."
          : null;
    const structured = textResponse(answer, ["rules"]);
    await persistAssistantMessage(activeConversation.id, answer, structured, ["rules"]);
    await logAiUsage({
      companyId: input.companyId,
      userId: input.userId,
      conversationId: activeConversation.id,
      provider: "rules",
      model: "rules",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - started,
      toolNames: [],
      success: true,
    });
    return {
      conversationId: activeConversation.id,
      message: answer,
      structured,
      provider: "rules",
      model: "rules",
      toolNames: [],
      responseMode: "rules_fallback",
      fallbackNotice,
    };
  }

  const model = resolveEffectiveModel(settings.model);
  const provider = createOpenAiProvider();
  const tools = listAiToolDefinitions();
  const systemPrompt = buildSystemPrompt({
    userName: input.userName,
    topic: input.topic,
    readOnlyMode: settings.readOnlyMode,
    language: settings.defaultLanguage,
  });

  let toolNames: string[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let finalMessage = "";
  let structured: AiStructuredResponse | null = null;
  const loopGuard = new AiToolLoopGuard();

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((item) => ({
      role: item.role as "user" | "assistant" | "system",
      content: item.content,
    })),
  ];

  let pendingMessages = [...messages];
  const maxRounds = getPlatformAiConfig().maxToolCalls;

  try {
    while (loopGuard.count <= maxRounds) {
      loopGuard.assertWithinTimeLimit();

      const result = await provider.generate({
        model,
        messages: pendingMessages,
        tools: loopGuard.count < maxRounds ? tools : undefined,
        maxOutputTokens: settings.maxResponseTokens,
        temperature: 0.3,
      });

      totalPromptTokens += result.usage.promptTokens;
      totalCompletionTokens += result.usage.completionTokens;

      if (result.toolCalls.length === 0) {
        finalMessage = result.message;
        structured = result.structured || textResponse(result.message);
        break;
      }

      const toolOutputs: string[] = [];
      for (const call of result.toolCalls) {
        try {
          const executed = await executeAiTool({
            name: call.name,
            argumentsJson: call.arguments,
            ctx: runtime,
            loopGuard,
          });
          toolNames.push(call.name);
          toolOutputs.push(
            JSON.stringify({ tool: call.name, data: executed.result })
          );
          await logToolExecution({
            conversationId: activeConversation.id,
            toolName: call.name,
            inputPayload: call.arguments,
            success: true,
            durationMs: executed.durationMs,
          });
        } catch (error) {
          const code =
            error instanceof AiServiceError ? error.code : "PROVIDER_ERROR";
          toolOutputs.push(JSON.stringify({ tool: call.name, error: code }));
          await logToolExecution({
            conversationId: activeConversation.id,
            toolName: call.name,
            inputPayload: call.arguments,
            success: false,
            durationMs: 0,
            errorCode: code,
          });
        }
      }

      pendingMessages = [
        ...pendingMessages,
        { role: "assistant", content: result.message || "Araç sonuçları hazır." },
        {
          role: "user",
          content: `Araç sonuçları:\n${toolOutputs.join("\n")}\n\nBu verilere göre Türkçe özet yanıt üret.`,
        },
      ];
    }
  } catch (error) {
    await logAiUsage({
      companyId: input.companyId,
      userId: input.userId,
      conversationId: activeConversation.id,
      provider: "openai",
      model,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      durationMs: Date.now() - started,
      toolNames,
      success: false,
      errorCode: error instanceof AiServiceError ? error.code : "PROVIDER_ERROR",
    });
    throw error;
  }

  if (!finalMessage) {
    finalMessage =
      "İstediğiniz bilgiyi güvenli araçlarla topladım ancak yanıt oluşturulamadı.";
    structured = textResponse(finalMessage, [...new Set(toolNames)]);
  }

  await persistAssistantMessage(
    activeConversation.id,
    finalMessage,
    structured,
    [...new Set(toolNames)]
  );

  await db.aIConversation.update({
    where: { id: activeConversation.id },
    data: { provider: "openai", model },
  });

  await logAiUsage({
    companyId: input.companyId,
    userId: input.userId,
    conversationId: activeConversation.id,
    provider: "openai",
    model,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    durationMs: Date.now() - started,
    toolNames,
    success: true,
  });

  return {
    conversationId: activeConversation.id,
    message: finalMessage,
    structured,
    provider: "openai",
    model,
    toolNames,
    responseMode: "openai",
    fallbackNotice: null,
  };
}

async function persistAssistantMessage(
  conversationId: string,
  content: string,
  structured: AiStructuredResponse | null,
  sourceModules: string[]
) {
  await db.aIMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content,
      structuredContent: structured || undefined,
      sourceModules,
    },
  });
}

export async function listUserConversations(companyId: string, userId: string) {
  return db.aIConversation.findMany({
    where: { companyId, userId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      provider: true,
      model: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });
}

export async function getConversationMessages(
  companyId: string,
  userId: string,
  conversationId: string
) {
  const conversation = await db.aIConversation.findFirst({
    where: { id: conversationId, companyId, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) throw new AiServiceError("CONVERSATION_NOT_FOUND", 404);
  return conversation;
}
