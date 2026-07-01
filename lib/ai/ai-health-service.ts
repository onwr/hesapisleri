import { getOrCreateCompanyAiSettings } from "@/lib/ai/company-ai-settings-repository";
import { resolveEffectiveModel } from "@/lib/ai/ai-config";
import { getAiUserMessage, type AiErrorCode } from "@/lib/ai/ai-errors";
import { createOpenAiProvider } from "@/lib/ai/openai-provider";
import { generateAiAnswer } from "@/lib/ai-assistant-page-utils";
import {
  resolveAiProviderStatus,
  type AiProviderStatus,
  type AiProviderStatusReport,
} from "@/lib/ai/ai-provider-status";
import { getMonthlyCostAlertStatus } from "@/lib/ai/ai-cost-alert-service";
import { getAiRateLimitStatus } from "@/lib/ai/ai-rate-limit-service";

export type AiHealthStatus = AiProviderStatus;

export type AiHealthReport = AiProviderStatusReport & {
  costAlertExceeded: boolean;
  rateLimited: boolean;
};

export async function getCompanyAiSettings(companyId: string) {
  return getOrCreateCompanyAiSettings(companyId);
}

export async function buildAiHealthReport(companyId: string): Promise<AiHealthReport> {
  const companySettings = await getCompanyAiSettings(companyId);
  const model = resolveEffectiveModel(companySettings.model);
  const [costAlert, rateStatus] = await Promise.all([
    getMonthlyCostAlertStatus(companyId),
    getAiRateLimitStatus(companyId),
  ]);

  const base = resolveAiProviderStatus({
    companyEnabled: companySettings.enabled,
    companyProvider: companySettings.provider,
    model,
  });

  const rateLimited =
    rateStatus.messagesLastMinute >= rateStatus.limits.maxMessagesPerMinute ||
    rateStatus.dailyTokens >= rateStatus.limits.maxDailyTokens ||
    rateStatus.dailyCostUsd >= rateStatus.limits.maxDailyCostUsd;

  if (rateLimited && base.status === "OPENAI_ACTIVE") {
    return {
      ...resolveAiProviderStatus({
        companyEnabled: companySettings.enabled,
        companyProvider: companySettings.provider,
        model,
        connectionErrorCode: "RATE_LIMITED",
      }),
      costAlertExceeded: costAlert.exceeded,
      rateLimited: true,
    };
  }

  return {
    ...base,
    costAlertExceeded: costAlert.exceeded,
    rateLimited,
  };
}

export async function testAiConnection(companyId: string) {
  const companySettings = await getCompanyAiSettings(companyId);
  const model = resolveEffectiveModel(companySettings.model);
  const base = resolveAiProviderStatus({
    companyEnabled: companySettings.enabled,
    companyProvider: companySettings.provider,
    model,
  });

  if (base.status === "MISSING_API_KEY" || base.usesRulesFallback) {
    const sample = generateAiAnswer("Bağlantı testi", {
      userFirstName: "Test",
      totalSales: 0,
      totalExpenses: 0,
      profit: 0,
      cashIncome: 0,
      saleCollectionIncome: 0,
      manualIncome: 0,
      manualCashExpense: 0,
      saleCancelExpense: 0,
      transferInTotal: 0,
      transferOutTotal: 0,
      salesCount: 0,
      expensesCount: 0,
      unpaidInvoiceTotal: 0,
      unpaidInvoiceCount: 0,
      accountBalance: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      riskScore: 0,
      riskLevel: "Düşük Risk",
      topProductName: "-",
      topProductRevenue: 0,
      topProductSoldQty: 0,
      topCustomerName: "-",
      topCustomerRevenue: 0,
      topCustomerSalesCount: 0,
      topExpenseCategory: "-",
      topExpenseAmount: 0,
      periodLabel: "Test",
    });
    return {
      ...base,
      message: sample
        ? "Kural tabanlı yedek mod çalışıyor. OpenAI bağlantısı kullanılmıyor."
        : base.message,
    };
  }

  if (!model) {
    return resolveAiProviderStatus({
      companyEnabled: companySettings.enabled,
      companyProvider: companySettings.provider,
      model: null,
      connectionErrorCode: "MODEL_MISSING",
    });
  }

  const provider = createOpenAiProvider();
  const test = await provider.testConnection(model);
  if (!test.ok) {
    return resolveAiProviderStatus({
      companyEnabled: companySettings.enabled,
      companyProvider: companySettings.provider,
      model,
      connectionErrorCode: test.code as AiErrorCode,
    });
  }

  return {
    ...resolveAiProviderStatus({
      companyEnabled: companySettings.enabled,
      companyProvider: companySettings.provider,
      model,
    }),
    message: "OpenAI bağlantı testi başarılı.",
  };
}

export function mapHealthCode(code: string): AiProviderStatus {
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "UNAUTHORIZED_KEY") return "INVALID_API_KEY";
  if (code === "API_KEY_MISSING") return "MISSING_API_KEY";
  if (code === "MODEL_MISSING") return "PROVIDER_UNAVAILABLE";
  if (code === "AI_DISABLED" || code === "PROVIDER_DISABLED") return "DISABLED";
  return "PROVIDER_UNAVAILABLE";
}

export function getHealthUserMessage(status: AiProviderStatus) {
  if (status === "INVALID_API_KEY") return getAiUserMessage("UNAUTHORIZED_KEY");
  if (status === "RATE_LIMITED") return getAiUserMessage("RATE_LIMITED");
  if (status === "PROVIDER_UNAVAILABLE") return getAiUserMessage("CONNECTION_FAILED");
  return "";
}
