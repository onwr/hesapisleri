import { resolveEffectiveModel } from "@/lib/ai/ai-config";
import { buildAiRuntimeContext } from "@/lib/ai/ai-context-builder";
import { shouldUseRulesFallback } from "@/lib/ai/ai-provider-status";
import { buildAiHealthReport } from "@/lib/ai/ai-health-service";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import {
  setModuleInsightCache,
  getModuleInsightCache,
} from "@/lib/ai/ai-insight-cache-service";
import {
  parseStructuredResponse,
  textResponse,
  type AiStructuredResponse,
} from "@/lib/ai/ai-structured-output";
import { logAiUsage } from "@/lib/ai/ai-usage-service";
import { getCompanyAiSettingsView } from "@/lib/ai/ai-settings-service";
import type { AiRuntimeContext } from "@/lib/ai/ai-context-builder";
import {
  getDashboardSummary,
  getSalesSummary,
  getTopProducts,
  getLowStockProducts,
  getDeadStockProducts,
  getCashFlowSummary,
  getAccountBalances,
  getOverdueInvoices,
  getUpcomingCollections,
  getCustomerBalance,
} from "@/lib/ai/ai-read-tools";
import type { PermissionRole } from "@/lib/permission-utils";

export type AiInsightCommentary = {
  commentary: string;
  blocks: AiStructuredResponse["blocks"];
  sourceModules: string[];
  period: { from: string; to: string };
  generatedAt: string;
  responseMode: "openai" | "rules_fallback";
  provider: string;
  model: string;
};

const MODULE_SOURCE_MAP: Record<string, string[]> = {
  dashboard: ["dashboard", "sales", "invoices", "stocks"],
  sales: ["sales", "products"],
  products: ["products", "stocks"],
  "cash-bank": ["cash-bank", "finance"],
  invoices: ["invoices", "customers"],
  customers: ["customers", "invoices"],
};

async function collectModuleToolData(moduleKey: string, runtime: AiRuntimeContext) {
  switch (moduleKey) {
    case "dashboard":
      return {
        summary: await getDashboardSummary({}, runtime),
        sales: await getSalesSummary({ limit: 5 }, runtime),
        lowStock: await getLowStockProducts({ limit: 5 }, runtime),
        overdue: await getOverdueInvoices({ limit: 5 }, runtime),
      };
    case "sales":
      return {
        summary: await getSalesSummary({ limit: 10 }, runtime),
        topProducts: await getTopProducts({ limit: 5 }, runtime),
      };
    case "products":
      return {
        lowStock: await getLowStockProducts({ limit: 10 }, runtime),
        deadStock: await getDeadStockProducts({ limit: 10 }, runtime),
      };
    case "cash-bank":
      return {
        cashFlow: await getCashFlowSummary({}, runtime),
        accounts: await getAccountBalances({ limit: 10 }, runtime),
      };
    case "invoices":
      return {
        overdue: await getOverdueInvoices({ limit: 10 }, runtime),
        upcoming: await getUpcomingCollections({ limit: 10 }, runtime),
      };
    case "customers":
      return {
        balances: await getCustomerBalance({ limit: 10 }, runtime),
        upcoming: await getUpcomingCollections({ limit: 10 }, runtime),
      };
    default:
      return null;
  }
}

function buildRulesCommentary(moduleKey: string, toolData: unknown): AiInsightCommentary {
  const sourceModules = MODULE_SOURCE_MAP[moduleKey] || [moduleKey];
  const text = `Bu dönem için ${moduleKey} modülü verileri özetlendi. Detaylı analiz için OpenAI bağlantısı gereklidir.`;
  const blocks = textResponse(text, sourceModules).blocks;
  return {
    commentary: text,
    blocks,
    sourceModules,
    period: { from: "", to: "" },
    generatedAt: new Date().toISOString(),
    responseMode: "rules_fallback",
    provider: "rules",
    model: "rules",
  };
}

export async function generateModuleInsightCommentary(input: {
  companyId: string;
  userId: string;
  userName: string;
  effectiveRole: PermissionRole;
  isOwner: boolean;
  moduleKey: string;
  from?: Date;
  to?: Date;
}): Promise<AiInsightCommentary> {
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
  });

  const model = resolveEffectiveModel(settings.model);

  const cached = await getModuleInsightCache<AiInsightCommentary>(
    input.companyId,
    `commentary-${input.moduleKey}`,
    { from: runtime.from, to: runtime.to, model }
  );
  if (cached) return cached;

  const toolData = await collectModuleToolData(input.moduleKey, runtime);
  if (!toolData) {
    throw new Error("Modül verisi bulunamadı.");
  }

  const health = await buildAiHealthReport(input.companyId);
  const sourceModules = MODULE_SOURCE_MAP[input.moduleKey] || [input.moduleKey];
  const period = {
    from: runtime.from.toISOString(),
    to: runtime.to.toISOString(),
  };

  if (shouldUseRulesFallback(health.status)) {
    const fallback = {
      ...buildRulesCommentary(input.moduleKey, toolData),
      period,
      sourceModules,
    };
    await setModuleInsightCache(input.companyId, `commentary-${input.moduleKey}`, fallback, {
      from: runtime.from,
      to: runtime.to,
      model,
      provider: "rules",
    });
    return fallback;
  }

  const provider = createOpenAiProvider();
  const started = Date.now();
  const prompt = `Sen bir Türkçe finans yönetici asistanısın. Aşağıdaki salt-okunur ERP verisine dayanarak kısa yönetici yorumu üret.
Yalnızca JSON structured output döndür. Yazma işlemi önerme; action_proposal yalnızca bilgi amaçlı link önerisi olabilir.
Veri:
${JSON.stringify(toolData).slice(0, 12000)}`;

  const result = await provider.generate({
    model,
    messages: [
      {
        role: "system",
        content:
          "Kısa Türkçe yönetici özeti üret. Yanıtı JSON olarak döndür: { blocks: [...], sourceModules: [...] }. blocks içinde text, metric, warning, table, chart_suggestion veya action_proposal kullanabilirsin.",
      },
      { role: "user", content: prompt },
    ],
    maxOutputTokens: settings.maxResponseTokens,
    temperature: 0.2,
  });

  const structured =
    result.structured ||
    parseStructuredResponse(safeJsonParse(result.message)) ||
    textResponse(result.message, sourceModules);

  const commentary =
    structured.blocks.find((b) => b.type === "text")?.content ||
    structured.blocks
      .map((b) => {
        if (b.type === "metric") return `${b.label}: ${b.value}`;
        if (b.type === "warning") return b.message;
        return "";
      })
      .filter(Boolean)
      .join(" ");

  const payload: AiInsightCommentary = {
    commentary,
    blocks: structured.blocks,
    sourceModules: structured.sourceModules.length
      ? structured.sourceModules
      : sourceModules,
    period,
    generatedAt: new Date().toISOString(),
    responseMode: "openai",
    provider: "openai",
    model,
  };

  await setModuleInsightCache(input.companyId, `commentary-${input.moduleKey}`, payload, {
    from: runtime.from,
    to: runtime.to,
    model,
    provider: "openai",
  });

  await logAiUsage({
    companyId: input.companyId,
    userId: input.userId,
    provider: "openai",
    model,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    toolNames: [],
    success: true,
  });

  return payload;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
