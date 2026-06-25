import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import { getAiUserMessage } from "@/lib/ai/ai-errors";

export type AiProviderStatus =
  | "OPENAI_ACTIVE"
  | "RULE_BASED_FALLBACK"
  | "DISABLED"
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE";

export const PROVIDER_STATUS_LABELS: Record<AiProviderStatus, string> = {
  OPENAI_ACTIVE: "OpenAI aktif",
  RULE_BASED_FALLBACK: "Kural tabanlı yedek mod",
  DISABLED: "Yapay zekâ kapalı",
  MISSING_API_KEY: "API anahtarı eksik",
  INVALID_API_KEY: "Geçersiz API anahtarı",
  RATE_LIMITED: "İstek limiti aşıldı",
  PROVIDER_UNAVAILABLE: "Sağlayıcı kullanılamıyor",
};

export const PROVIDER_STATUS_MESSAGES: Record<AiProviderStatus, string> = {
  OPENAI_ACTIVE: "OpenAI bağlantısı yapılandırılmış ve kullanıma hazır.",
  RULE_BASED_FALLBACK:
    "OpenAI kullanılamıyor; yanıtlar kural tabanlı modda üretiliyor. Bu mod sınırlı özetler sunar.",
  DISABLED: "Yapay zekâ bu şirket veya platform için devre dışı.",
  MISSING_API_KEY:
    "OpenAI API anahtarı tanımlı değil. Ayarlardan yapılandırın veya kural tabanlı mod kullanılacak.",
  INVALID_API_KEY: getAiUserMessage("UNAUTHORIZED_KEY"),
  RATE_LIMITED: getAiUserMessage("RATE_LIMITED"),
  PROVIDER_UNAVAILABLE: getAiUserMessage("CONNECTION_FAILED"),
};

export type AiProviderStatusReport = {
  status: AiProviderStatus;
  label: string;
  message: string;
  provider: string;
  model: string | null;
  canChat: boolean;
  usesRulesFallback: boolean;
  openAiConfigured: boolean;
};

type ResolveStatusInput = {
  companyEnabled: boolean;
  companyProvider: string;
  model: string | null;
  connectionErrorCode?: string | null;
};

export function isOpenAiConfigured() {
  const platform = getPlatformAiConfig();
  return (
    platform.platformEnabled &&
    Boolean(platform.apiKey) &&
    platform.provider !== "rules"
  );
}

export function shouldUseRulesFallback(status: AiProviderStatus) {
  return status === "RULE_BASED_FALLBACK" || status === "MISSING_API_KEY";
}

export function resolveAiProviderStatus(
  input: ResolveStatusInput
): AiProviderStatusReport {
  const platform = getPlatformAiConfig();
  const openAiConfigured = isOpenAiConfigured();
  const provider = input.companyProvider || platform.provider;
  const model = input.model;

  if (!input.companyEnabled) {
    return {
      status: "DISABLED",
      label: PROVIDER_STATUS_LABELS.DISABLED,
      message: "Yapay zekâ bu şirket için devre dışı bırakılmış.",
      provider,
      model,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  if (!platform.platformEnabled) {
    return {
      status: "DISABLED",
      label: PROVIDER_STATUS_LABELS.DISABLED,
      message: PROVIDER_STATUS_MESSAGES.DISABLED,
      provider,
      model,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  if (input.connectionErrorCode === "RATE_LIMITED") {
    return {
      status: "RATE_LIMITED",
      label: PROVIDER_STATUS_LABELS.RATE_LIMITED,
      message: PROVIDER_STATUS_MESSAGES.RATE_LIMITED,
      provider: "openai",
      model,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  if (input.connectionErrorCode === "UNAUTHORIZED_KEY") {
    return {
      status: "INVALID_API_KEY",
      label: PROVIDER_STATUS_LABELS.INVALID_API_KEY,
      message: PROVIDER_STATUS_MESSAGES.INVALID_API_KEY,
      provider: "openai",
      model,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  if (
    input.connectionErrorCode === "CONNECTION_FAILED" ||
    input.connectionErrorCode === "PROVIDER_ERROR" ||
    input.connectionErrorCode === "TIMEOUT"
  ) {
    return {
      status: "PROVIDER_UNAVAILABLE",
      label: PROVIDER_STATUS_LABELS.PROVIDER_UNAVAILABLE,
      message: PROVIDER_STATUS_MESSAGES.PROVIDER_UNAVAILABLE,
      provider: "openai",
      model,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  if (input.companyProvider === "rules" || platform.provider === "rules") {
    return {
      status: "RULE_BASED_FALLBACK",
      label: PROVIDER_STATUS_LABELS.RULE_BASED_FALLBACK,
      message: PROVIDER_STATUS_MESSAGES.RULE_BASED_FALLBACK,
      provider: "rules",
      model,
      canChat: true,
      usesRulesFallback: true,
      openAiConfigured,
    };
  }

  if (!platform.apiKey) {
    return {
      status: "MISSING_API_KEY",
      label: PROVIDER_STATUS_LABELS.MISSING_API_KEY,
      message: PROVIDER_STATUS_MESSAGES.MISSING_API_KEY,
      provider: "rules",
      model,
      canChat: true,
      usesRulesFallback: true,
      openAiConfigured: false,
    };
  }

  if (!model) {
    return {
      status: "PROVIDER_UNAVAILABLE",
      label: PROVIDER_STATUS_LABELS.PROVIDER_UNAVAILABLE,
      message: getAiUserMessage("MODEL_MISSING"),
      provider: "openai",
      model: null,
      canChat: false,
      usesRulesFallback: false,
      openAiConfigured,
    };
  }

  return {
    status: "OPENAI_ACTIVE",
    label: PROVIDER_STATUS_LABELS.OPENAI_ACTIVE,
    message: PROVIDER_STATUS_MESSAGES.OPENAI_ACTIVE,
    provider: "openai",
    model,
    canChat: true,
    usesRulesFallback: false,
    openAiConfigured,
  };
}
