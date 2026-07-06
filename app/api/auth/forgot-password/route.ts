import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/register-schema";
import { requestPasswordReset } from "@/lib/auth/password-reset-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";
import {
  checkAuthRateLimit,
  registerAuthFailure,
} from "@/lib/auth/auth-rate-limit-service";

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const GENERIC_SUCCESS_MESSAGE =
  "E-posta adresiniz sistemimizde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.";

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
    const clientIp = getTrustedClientIp(req);
    const rateLimit = await checkAuthRateLimit("forgot-password", clientIp);
    if (rateLimit.limited) {
      return tooManyAttemptsResponse(rateLimit.retryAfterSeconds);
    }

    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçerli bir e-posta adresi girin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Her istek (kullanıcı var/yok fark etmeksizin) sayaca ekleniyor —
    // enumeration'a karşı hem mesaj hem rate-limit davranışı sabit kalıyor.
    const failure = await registerAuthFailure("forgot-password", clientIp);
    if (failure.limited) {
      return tooManyAttemptsResponse(failure.retryAfterSeconds);
    }

    await requestPasswordReset({ email: parsed.data.email });

    // Kullanıcı var mı yok mu fark etmeksizin AYNI genel mesaj — e-posta
    // enumeration koruması.
    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Hata durumunda da AYNI genel mesajı döneriz — enumeration/iç hata
    // detayı sızdırmaz.
    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  }
}
