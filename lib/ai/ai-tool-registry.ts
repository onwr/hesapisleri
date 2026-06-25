import { z } from "zod";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import type { AiProviderToolDefinition } from "@/lib/ai/ai-provider";
import { assertToolPermission } from "@/lib/ai/ai-permission-service";
import type { AiRuntimeContext } from "@/lib/ai/ai-context-builder";
import {
  AI_READ_TOOL_HANDLERS,
  AI_READ_TOOL_SCHEMAS,
  type AiReadToolName,
} from "@/lib/ai/ai-read-tools";
import { serializeForAi } from "@/lib/ai/ai-redaction";
import { AiToolLoopGuard } from "@/lib/ai/ai-tool-loop-guard";
import { assertAiToolRateLimit } from "@/lib/ai/ai-rate-limit-service";

const TOOL_DESCRIPTIONS: Record<AiReadToolName, string> = {
  getDashboardSummary: "Şirketin genel özet metriklerini getirir.",
  getSalesSummary: "Belirli dönem satış özetini getirir.",
  getTopProducts: "En çok satan ürünleri getirir.",
  getLowStockProducts: "Düşük stoklu ürünleri getirir.",
  getDeadStockProducts: "Uzun süredir satılmayan stoklu ürünleri getirir.",
  getCashFlowSummary: "Nakit giriş/çıkış özetini getirir.",
  getAccountBalances: "Aktif kasa ve banka bakiyelerini getirir.",
  getExpenseSummary: "Gider özetini ve kategori dağılımını getirir.",
  getOverdueInvoices: "Vadesi geçmiş faturaları getirir.",
  getUpcomingCollections: "Yaklaşan tahsilatları getirir.",
  getCustomerBalance: "Müşteri bakiyelerini veya tek müşteri bakiyesini getirir.",
  getCustomerSalesSummary: "Müşteri satış özetini getirir.",
  getSupplierSummary: "Tedarikçi bakiye özetini getirir.",
  getEmployeePaymentSummary: "Çalışan ödeme özetini getirir.",
  getMarketplaceSummary: "Pazaryeri entegrasyon özetini getirir.",
  getCalendarSummary: "Takvim etkinlik özetini getirir.",
  getNotificationSummary: "Kullanıcının bildirim özetini getirir.",
};

function zodToJsonSchema(_schema: z.ZodTypeAny): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      from: { type: "string" },
      to: { type: "string" },
      limit: { type: "number" },
      customerId: { type: "string" },
    },
    additionalProperties: false,
  };
}

export function listAiToolDefinitions(): AiProviderToolDefinition[] {
  return (Object.keys(AI_READ_TOOL_SCHEMAS) as AiReadToolName[]).map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    parameters: zodToJsonSchema(AI_READ_TOOL_SCHEMAS[name] as z.ZodTypeAny),
    strict: true,
  }));
}

export function isAllowedAiToolName(name: string): name is AiReadToolName {
  return name in AI_READ_TOOL_HANDLERS;
}

export function assertWriteToolNotRegistered(name: string) {
  if (isAllowedAiToolName(name)) return;
  const registry = listAiToolDefinitions();
  if (registry.some((tool) => tool.name === name)) {
    throw new Error(`Write tool registered: ${name}`);
  }
}

export async function executeAiTool(input: {
  name: string;
  argumentsJson: string;
  ctx: AiRuntimeContext;
  loopGuard: AiToolLoopGuard;
}) {
  if (!isAllowedAiToolName(input.name)) {
    throw new AiServiceError("TOOL_NOT_ALLOWED", 403);
  }

  assertToolPermission(input.name, input.ctx);
  await assertAiToolRateLimit(input.ctx.companyId);
  input.loopGuard.registerToolCall(input.name, input.argumentsJson);

  let rawArgs: unknown = {};
  try {
    rawArgs = JSON.parse(input.argumentsJson || "{}");
  } catch {
    throw new AiServiceError("TOOL_VALIDATION_FAILED", 400);
  }

  if (rawArgs && typeof rawArgs === "object" && "companyId" in rawArgs) {
    throw new AiServiceError("TENANT_MISMATCH", 403);
  }

  const parsed = AI_READ_TOOL_SCHEMAS[input.name].safeParse(rawArgs);
  if (!parsed.success) {
    throw new AiServiceError("TOOL_VALIDATION_FAILED", 400);
  }

  const started = Date.now();
  const result = await AI_READ_TOOL_HANDLERS[input.name](parsed.data, input.ctx);
  return {
    name: input.name,
    result: input.loopGuard.truncateToolResult(serializeForAi(result)),
    durationMs: Date.now() - started,
  };
}

export function getRegisteredToolNames() {
  return Object.keys(AI_READ_TOOL_HANDLERS) as AiReadToolName[];
}

export function assertRegistryHasNoWriteTools(writeToolNames: Set<string>) {
  const registered = new Set(getRegisteredToolNames());
  for (const writeName of writeToolNames) {
    if (registered.has(writeName as AiReadToolName)) {
      throw new Error(`Write tool must not be registered: ${writeName}`);
    }
  }
}
