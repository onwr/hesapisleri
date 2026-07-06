import { NextResponse } from "next/server";
import { contactFormSchema } from "@/lib/contact-schema";
import { sendMail, isMailConfigured } from "@/lib/mail-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";
import {
  checkAuthRateLimit,
  registerAuthFailure,
  clearAuthRateLimit,
} from "@/lib/auth/auth-rate-limit-service";
import {
  getPlatformSettings,
  getPlatformSettingsFallback,
} from "@/lib/admin/platform-settings/platform-settings-loader";

const GENERIC_SUCCESS_MESSAGE = "Mesajınız alındı. En kısa sürede size dönüş yapacağız.";
const GENERIC_ERROR_MESSAGE =
  "Mesajınız şu anda gönderilemedi. Lütfen daha sonra tekrar deneyin.";

function tooManyAttemptsResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      message: `Çok fazla deneme. Lütfen ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} dakika sonra tekrar deneyin.`,
      code: "RATE_LIMITED",
      retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: Request) {
  try {
    if (!isMailConfigured()) {
      // Mail altyapısı yokken form hiç sunulmamalı (bkz. contact-section.tsx —
      // isMailConfigured false ise form yerine mailto fallback gösterilir).
      // Yine de doğrudan API'ye istek atılırsa açık, iç detay sızdırmayan
      // bir hata döneriz.
      return NextResponse.json(
        { success: false, message: "İletişim formu şu anda kullanılamıyor." },
        { status: 503 }
      );
    }

    const clientIp = getTrustedClientIp(req);
    const ipLimit = await checkAuthRateLimit("contact", clientIp);
    if (ipLimit.limited) {
      return tooManyAttemptsResponse(ipLimit.retryAfterSeconds);
    }

    const body = await req.json();
    const parsed = contactFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Honeypot doldurulmuşsa (bot) — kullanıcıya normal başarı mesajı
    // döneriz (botu bilgilendirmemek için) ama hiçbir mail göndermeyiz.
    if (parsed.data.website) {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    // E-posta VE IP bazlı ayrı limit — aynı kişi farklı IP'lerden spam
    // yapamasın, aynı IP farklı e-postalarla spam yapamasın.
    const emailLimit = await checkAuthRateLimit("contact", parsed.data.email);
    if (emailLimit.limited) {
      return tooManyAttemptsResponse(emailLimit.retryAfterSeconds);
    }

    const settings = await getPlatformSettings().catch(() => getPlatformSettingsFallback());

    const result = await sendMail({
      to: settings.supportEmail,
      replyTo: parsed.data.email,
      subject: `[İletişim Formu] ${parsed.data.subject}`,
      text: `Ad Soyad: ${parsed.data.name}\nE-posta: ${parsed.data.email}\n\n${parsed.data.message}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
          <h3>Yeni iletişim formu mesajı</h3>
          <p><strong>Ad Soyad:</strong> ${escapeHtml(parsed.data.name)}</p>
          <p><strong>E-posta:</strong> ${escapeHtml(parsed.data.email)}</p>
          <p><strong>Konu:</strong> ${escapeHtml(parsed.data.subject)}</p>
          <p style="white-space:pre-wrap;">${escapeHtml(parsed.data.message)}</p>
        </div>
      `,
    });

    if (!result.ok) {
      const failure = await registerAuthFailure("contact", clientIp);
      await registerAuthFailure("contact", parsed.data.email);
      console.error("CONTACT_FORM_SEND_FAILED", { reason: result.reason });
      if (failure.limited) {
        return tooManyAttemptsResponse(failure.retryAfterSeconds);
      }
      return NextResponse.json(
        { success: false, message: GENERIC_ERROR_MESSAGE },
        { status: 502 }
      );
    }

    await clearAuthRateLimit("contact", clientIp);
    await clearAuthRateLimit("contact", parsed.data.email);

    return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error("CONTACT_FORM_ERROR", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
