import { z } from "zod";
import { getOrCreateCompanyAiSettings } from "@/lib/ai/company-ai-settings-repository";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import { db } from "@/lib/prisma";

export const updateCompanyAiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["openai", "rules"]).optional(),
  model: z.string().trim().min(1).max(120).optional().nullable(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  maxResponseTokens: z.number().int().min(100).max(4000).optional(),
  monthlyCostWarningUsd: z.number().min(0).max(10000).optional().nullable(),
  readOnlyMode: z.boolean().optional(),
  requireUserApproval: z.boolean().optional(),
  autoDisableOnCostExceeded: z.boolean().optional(),
});

export type CompanyAiSettingsView = {
  enabled: boolean;
  provider: string;
  model: string | null;
  defaultLanguage: string;
  maxResponseTokens: number;
  monthlyCostWarningUsd: number | null;
  readOnlyMode: boolean;
  requireUserApproval: boolean;
  autoDisableOnCostExceeded: boolean;
  platformModel: string;
  platformProvider: string;
  platformEnabled: boolean;
  hasApiKey: boolean;
};

export async function getCompanyAiSettingsView(
  companyId: string
): Promise<CompanyAiSettingsView> {
  const platform = getPlatformAiConfig();
  const settings = await getOrCreateCompanyAiSettings(companyId);

  return {
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model,
    defaultLanguage: settings.defaultLanguage,
    maxResponseTokens: settings.maxResponseTokens,
    monthlyCostWarningUsd: settings.monthlyCostWarningUsd
      ? Number(settings.monthlyCostWarningUsd)
      : null,
    readOnlyMode: settings.readOnlyMode,
    requireUserApproval: settings.requireUserApproval,
    autoDisableOnCostExceeded: settings.autoDisableOnCostExceeded,
    platformModel: platform.model,
    platformProvider: platform.provider,
    platformEnabled: platform.platformEnabled,
    hasApiKey: Boolean(platform.apiKey),
  };
}

export async function updateCompanyAiSettings(
  companyId: string,
  input: z.infer<typeof updateCompanyAiSettingsSchema>
) {
  const parsed = updateCompanyAiSettingsSchema.parse(input);
  await getOrCreateCompanyAiSettings(companyId);
  return db.companyAISettings.update({
    where: { companyId },
    data: {
      ...parsed,
      monthlyCostWarningUsd: parsed.monthlyCostWarningUsd ?? undefined,
    },
  });
}
