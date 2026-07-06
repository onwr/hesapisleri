import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/lib/auth/register-schema";
import {
  consumePasswordResetToken,
  PasswordResetTokenError,
  validatePasswordResetToken,
} from "@/lib/auth/password-reset-service";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Bağlantı geçersiz."),
  password: passwordSchema,
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Bağlantı geçersiz veya süresi dolmuş." },
      { status: 400 }
    );
  }

  const result = await validatePasswordResetToken(token);
  if (!result.valid) {
    return NextResponse.json(
      { success: false, message: "Bağlantı geçersiz veya süresi dolmuş." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

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

    await consumePasswordResetToken({
      rawToken: parsed.data.token,
      newPassword: parsed.data.password,
    });

    return NextResponse.json({
      success: true,
      message: "Şifreniz güncellendi. Şimdi giriş yapabilirsiniz.",
    });
  } catch (error) {
    if (error instanceof PasswordResetTokenError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: 400 }
      );
    }

    console.error("RESET_PASSWORD_ERROR", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, message: "Şifre güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
