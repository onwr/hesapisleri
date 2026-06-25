export type AiProviderName = "openai" | "rules";

export type PlatformAiConfig = {
  apiKey: string;
  model: string;
  provider: string;
  platformEnabled: boolean;
  maxToolCalls: number;
  maxDateRangeDays: number;
  maxResultLimit: number;
  requestTimeoutMs: number;
  storeResponses: boolean;
};

export const DEFAULT_AI_MODEL = "gpt-4o-mini";

export function getPlatformAiConfig(): PlatformAiConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || "",
    model:
      process.env.OPENAI_MODEL?.trim() ||
      process.env.AI_MODEL?.trim() ||
      DEFAULT_AI_MODEL,
    provider: (process.env.AI_PROVIDER || "auto").toLowerCase(),
    platformEnabled: process.env.OPENAI_AI_ENABLED !== "false",
    maxToolCalls: Number(process.env.AI_MAX_TOOL_CALLS || 5),
    maxDateRangeDays: Number(process.env.AI_MAX_DATE_RANGE_DAYS || 366),
    maxResultLimit: Number(process.env.AI_MAX_RESULT_LIMIT || 50),
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000),
    storeResponses: false,
  };
}

export function resolveEffectiveModel(companyModel?: string | null) {
  const platform = getPlatformAiConfig();
  return companyModel?.trim() || platform.model || DEFAULT_AI_MODEL;
}

export const WRITE_ACTION_TOOL_NAMES = new Set([
  "createSale",
  "cancelSale",
  "updateStock",
  "recordCollection",
  "recordExpense",
  "recordEmployeePayment",
  "sendInvoice",
  "sendEDocument",
  "updateUserRole",
]);
