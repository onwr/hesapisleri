export const API_USER_ERROR_MESSAGES = {
  VALIDATION_ERROR: "Bilgileri kontrol edin.",
  UNAUTHORIZED: "Oturum bulunamadı.",
  FORBIDDEN: "Bu işlem için yetkiniz bulunmuyor.",
  NOT_FOUND: "Kayıt bulunamadı.",
  CONFLICT: "İşlem çakışması nedeniyle tamamlanamadı.",
  RATE_LIMITED: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
  INTERNAL_ERROR: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
} as const;

export function humanizeZodFieldError(
  field: string,
  message: string,
  fieldLabels: Record<string, string> = {}
) {
  const label = fieldLabels[field] ?? field;

  if (/[ğüşıöçĞÜŞİÖÇ]/.test(message)) {
    return message;
  }

  if (message.includes("expected string, received null")) {
    return `${label} alanı geçersiz.`;
  }
  if (message.includes("expected string, received number")) {
    return `${label} metin olmalıdır.`;
  }
  if (message.includes("expected number, received")) {
    return `${label} sayısal bir değer olmalıdır.`;
  }
  if (
    message.includes("Invalid enum value") ||
    message.includes("Invalid option")
  ) {
    return `${label} için geçersiz seçim.`;
  }
  if (
    message.includes("Too small") ||
    message.includes("too small") ||
    message.includes("String must contain at least")
  ) {
    if (message.includes("email")) {
      return "Geçerli bir e-posta adresi girin.";
    }
    return `${label} çok kısa.`;
  }
  if (message.includes("Too big") || message.includes("too big")) {
    return `${label} çok uzun.`;
  }
  if (message.includes("Invalid email")) {
    return "Geçerli bir e-posta adresi girin.";
  }
  if (message.startsWith("Invalid input")) {
    return `${label} alanı geçersiz.`;
  }
  if (message === "Required") {
    return "Bu alan zorunludur.";
  }

  return message;
}

export function mapZodFieldErrors(
  errors?: Record<string, string[] | undefined>,
  fieldLabels?: Record<string, string>
) {
  if (!errors) return {};

  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      messages?.[0]
        ? humanizeZodFieldError(field, messages[0], fieldLabels)
        : API_USER_ERROR_MESSAGES.VALIDATION_ERROR,
    ])
  );
}

export function getFirstZodErrorMessage(
  errors?: Record<string, string[] | undefined>,
  fieldLabels?: Record<string, string>
) {
  const mapped = mapZodFieldErrors(errors, fieldLabels);
  return Object.values(mapped)[0] ?? API_USER_ERROR_MESSAGES.VALIDATION_ERROR;
}

const PRISMA_ERROR_PATTERNS = [
  /prisma/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /invocation/i,
  /P\d{4}/,
];

export function sanitizeUserFacingApiError(
  error: unknown,
  fallback = API_USER_ERROR_MESSAGES.INTERNAL_ERROR
) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  if (/[ğüşıöçĞÜŞİÖÇ]/.test(message)) {
    return message;
  }

  if (PRISMA_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  if (
    /^(required|invalid|expected|unauthorized|forbidden|not found|validation failed|something went wrong)/i.test(
      message
    )
  ) {
    return humanizeZodFieldError("form", message);
  }

  return message;
}
