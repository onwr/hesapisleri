import "server-only";

/**
 * Tek canonical mail gönderme servisi. Provider: Resend (env'de zaten
 * RESEND_API_KEY olarak anılıyordu — bkz. .env.production.example).
 *
 * MAIL_PROVIDER=resend  -> gerçek gönderim (Resend API)
 * MAIL_PROVIDER=test    -> yalnız NODE_ENV!=="production" ortamında izinli,
 *                          hiçbir gerçek e-posta göndermez, bellekte toplar
 *                          (test/dev için). Production'da bu adapter asla
 *                          başlatılamaz — aşağıda açıkça engellenir.
 *
 * Hiçbir koşulda reset token/link/URL veya mail içeriği console.log/warn/error
 * ile loglanmaz — bkz. requestPasswordReset (password-reset-service.ts).
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendMailResult =
  | { ok: true }
  | { ok: false; reason: "PROVIDER_NOT_CONFIGURED" | "SEND_FAILED" };

const isProduction = process.env.NODE_ENV === "production";

// Yalnız test/dev ortamında, yalnız test adapter aktifken doldurulur.
const testOutbox: MailMessage[] = [];

export function _getTestOutbox() {
  if (isProduction) {
    throw new Error("_getTestOutbox production'da çağrılamaz.");
  }
  return testOutbox;
}

export function _clearTestOutbox() {
  testOutbox.length = 0;
}

function resolveMailProvider(): "resend" | "test" | "unconfigured" {
  const configured = process.env.MAIL_PROVIDER?.trim().toLowerCase();

  if (configured === "test") {
    if (isProduction) {
      // Production'da test/console adapter'ın başlatılması KESİNLİKLE
      // engellenir — yanlışlıkla "gönderildi" sanılıp e-postanın hiç
      // gitmemesi riskine karşı.
      throw new Error(
        "MAIL_PROVIDER=test production ortamında kullanılamaz. RESEND_API_KEY ile MAIL_PROVIDER=resend yapılandırın."
      );
    }
    return "test";
  }

  if (configured === "resend" || (!configured && process.env.RESEND_API_KEY)) {
    return process.env.RESEND_API_KEY ? "resend" : "unconfigured";
  }

  return "unconfigured";
}

async function sendViaResend(message: MailMessage): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM?.trim();

  if (!apiKey || !from) {
    console.error("MAIL_SEND_FAILED", { reason: "PROVIDER_NOT_CONFIGURED" });
    return { ok: false, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });

    if (result.error) {
      // Resend hata detayını (ör. domain doğrulama sorunu) loglar ama
      // mesaj İÇERİĞİNİ (reset linki/token) ASLA loglamaz.
      console.error("MAIL_SEND_FAILED", {
        reason: "SEND_FAILED",
        providerErrorName: result.error.name,
      });
      return { ok: false, reason: "SEND_FAILED" };
    }

    return { ok: true };
  } catch (error) {
    console.error("MAIL_SEND_FAILED", {
      reason: "SEND_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "SEND_FAILED" };
  }
}

async function sendViaTestAdapter(message: MailMessage): Promise<SendMailResult> {
  testOutbox.push(message);
  return { ok: true };
}

export async function sendMail(message: MailMessage): Promise<SendMailResult> {
  const provider = resolveMailProvider();

  if (provider === "unconfigured") {
    console.error("MAIL_SEND_FAILED", { reason: "PROVIDER_NOT_CONFIGURED" });
    return { ok: false, reason: "PROVIDER_NOT_CONFIGURED" };
  }

  if (provider === "test") {
    return sendViaTestAdapter(message);
  }

  return sendViaResend(message);
}

/** Mail altyapısının gerçekten yapılandırılıp yapılandırılmadığını (production
 * için) bildirir — UI'da "iletişim formu aktif mi" gibi kararlar için. */
export function isMailConfigured(): boolean {
  try {
    const provider = resolveMailProvider();
    return provider === "resend" || provider === "test";
  } catch {
    return false;
  }
}
