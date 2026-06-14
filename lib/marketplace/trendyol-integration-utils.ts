import type { TrendyolCredentials } from "@/lib/marketplace/adapters/trendyol-adapter";

export type TrendyolCredentialInput = {
  supplierId?: string;
  apiKey?: string;
  apiSecret?: string;
};

export function trendyolRequiresFreshSecrets(input: {
  hasStoredCredentials: boolean;
  status?: string | null;
}) {
  if (!input.hasStoredCredentials) return true;
  return input.status === "ERROR";
}

export function resolveTrendyolCredentials(
  input: TrendyolCredentialInput,
  existing?: TrendyolCredentials | null,
  options?: { requireFreshSecrets?: boolean }
): TrendyolCredentials {
  const supplierId = input.supplierId?.trim();
  if (!supplierId) {
    throw new Error("Trendyol satıcı numarası zorunludur.");
  }

  if (options?.requireFreshSecrets) {
    if (!input.apiKey?.trim() || !input.apiSecret?.trim()) {
      throw new Error(
        "Trendyol bağlantı hatası nedeniyle API Key ve API Secret alanlarını yeniden girmeniz gerekir."
      );
    }
  }

  const apiKey = input.apiKey?.trim() || existing?.apiKey;
  const apiSecret = input.apiSecret?.trim() || existing?.apiSecret;
  if (!apiKey || !apiSecret) {
    throw new Error("Trendyol API anahtarı ve gizli anahtar zorunludur.");
  }

  return { supplierId, apiKey, apiSecret };
}

export function buildTrendyolBasicAuth(credentials: TrendyolCredentials) {
  const raw = `${credentials.apiKey}:${credentials.apiSecret}`;
  return Buffer.from(raw).toString("base64");
}

export function storedCredentialTestFailureMessage(message: string) {
  if (
    message.includes("yetkisiz") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return `${message} Kayıtlı credential geçersiz olabilir; Yapılandır ekranından API Key ve Secret alanlarını yeniden girin.`;
  }
  return message;
}

export function isIntegrationValidationError(message: string) {
  const normalized = message.toLocaleLowerCase("tr-TR");
  return (
    normalized.includes("yeniden girmeniz gerekir") ||
    normalized.includes("zorunludur") ||
    normalized.includes("geçersiz") ||
    normalized.includes("eksik")
  );
}
