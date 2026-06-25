export type AiErrorCode =
  | "AI_DISABLED"
  | "API_KEY_MISSING"
  | "PROVIDER_DISABLED"
  | "MODEL_MISSING"
  | "CONNECTION_FAILED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED_KEY"
  | "TIMEOUT"
  | "TOOL_NOT_ALLOWED"
  | "TOOL_VALIDATION_FAILED"
  | "TOOL_LIMIT_EXCEEDED"
  | "READ_ONLY_VIOLATION"
  | "PERMISSION_DENIED"
  | "TENANT_MISMATCH"
  | "CONVERSATION_NOT_FOUND"
  | "PROVIDER_ERROR";

const USER_MESSAGES: Record<AiErrorCode, string> = {
  AI_DISABLED: "Yapay zekâ özelliği şu anda kapalı.",
  API_KEY_MISSING: "Yapay zekâ API anahtarı tanımlı değil. Ayarlardan yapılandırın.",
  PROVIDER_DISABLED: "Yapay zekâ sağlayıcısı devre dışı.",
  MODEL_MISSING: "Yapay zekâ modeli seçilmemiş.",
  CONNECTION_FAILED: "Yapay zekâ servisine bağlanılamadı. Lütfen daha sonra tekrar deneyin.",
  RATE_LIMITED: "Yapay zekâ istek limitine ulaşıldı. Biraz bekleyip tekrar deneyin.",
  UNAUTHORIZED_KEY: "Yapay zekâ API anahtarı geçersiz. Anahtarı kontrol edin.",
  TIMEOUT: "Yapay zekâ yanıtı zaman aşımına uğradı.",
  TOOL_NOT_ALLOWED: "Bu sorgu için izin verilen araç kullanılamıyor.",
  TOOL_VALIDATION_FAILED: "Araç parametreleri geçersiz.",
  TOOL_LIMIT_EXCEEDED: "Tek istekte izin verilen araç çağrısı sınırına ulaşıldı.",
  READ_ONLY_VIOLATION: "Yapay zekâ yalnızca okuma işlemleri yapabilir.",
  PERMISSION_DENIED: "Bu veriye erişim yetkiniz yok.",
  TENANT_MISMATCH: "Bu veriye erişim yetkiniz yok.",
  CONVERSATION_NOT_FOUND: "Konuşma bulunamadı.",
  PROVIDER_ERROR: "Yapay zekâ servisi şu anda yanıt veremiyor.",
};

export class AiServiceError extends Error {
  code: AiErrorCode;
  status: number;

  constructor(code: AiErrorCode, status = 500) {
    super(USER_MESSAGES[code]);
    this.name = "AiServiceError";
    this.code = code;
    this.status = status;
  }
}

export function mapOpenAiHttpStatus(status: number): AiErrorCode {
  if (status === 401) return "UNAUTHORIZED_KEY";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "CONNECTION_FAILED";
  return "PROVIDER_ERROR";
}

export function getAiUserMessage(code: AiErrorCode) {
  return USER_MESSAGES[code];
}
