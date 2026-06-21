const SENSITIVE_KEY = /secret|token|password|authorization|credential|apikey|api_key|salt|merchant/i;

const PROBLEM_MESSAGES: Record<string, string> = {
  "/problem/connection-error": "E-Faturam servisine bağlanılamadı. Lütfen tekrar deneyin.",
  "/problem/unauthorized": "E-Faturam oturumu geçersiz. Bağlantıyı yeniden kurun.",
  "/problem/forbidden": "Bu işlem için yetkiniz yok.",
  "/problem/not-found": "İstenen kayıt bulunamadı.",
  "/problem/validation-error": "Gönderilen fatura bilgileri geçersiz.",
  "/problem/duplicate-invoice": "Bu fatura daha önce gönderilmiş.",
  "/problem/prefix-unusable": "Fatura öneki kullanılamıyor. Ayarlardan kontrol edin.",
  "/problem/application-mismatch": "E-Faturam hesap uygulaması uyumsuz.",
};

export type ProblemJson = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
};

export function sanitizeProviderPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item));
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = sanitizeProviderPayload(child);
  }
  return output;
}

export function translateEfaturamProblem(problem: ProblemJson, fallback?: string) {
  const type = problem.type?.trim();
  if (type && PROBLEM_MESSAGES[type]) {
    return PROBLEM_MESSAGES[type];
  }

  const detail = problem.detail?.trim();
  if (detail && !SENSITIVE_KEY.test(detail)) {
    return detail;
  }

  const title = problem.title?.trim();
  if (title && !SENSITIVE_KEY.test(title)) {
    return title;
  }

  return fallback ?? "E-Faturam işlemi tamamlanamadı.";
}

export function parseEfaturamErrorBody(body: unknown, fallback?: string) {
  if (!body || typeof body !== "object") {
    return fallback ?? "E-Faturam işlemi tamamlanamadı.";
  }

  return translateEfaturamProblem(body as ProblemJson, fallback);
}
