import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendMail } from "@/lib/mail-service";
import {
  getPlatformSettings,
  getPlatformSettingsFallback,
} from "@/lib/admin/platform-settings/platform-settings-loader";

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 dakika

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function buildResetEmail(input: { resetLink: string; brandName: string }) {
  const { resetLink, brandName } = input;
  const text = `${brandName} hesabınız için şifre sıfırlama talebi aldık.\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın (30 dakika geçerlidir):\n${resetLink}\n\nBu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${brandName} — Şifre Sıfırlama</h2>
      <p>Hesabınız için şifre sıfırlama talebi aldık.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">Şifremi Sıfırla</a></p>
      <p style="color:#64748b;font-size:13px;">Bu bağlantı 30 dakika geçerlidir. Bu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.</p>
    </div>
  `;
  return { html, text };
}

/**
 * Kullanıcı self-service şifre sıfırlama talebi oluşturur ve reset linkini
 * YALNIZ e-posta ile gönderir — bkz. lib/mail-service.ts (canonical mail
 * servisi). Token/link/URL hiçbir koşulda server log'una yazılmaz.
 *
 * Kullanıcı var/yok ayrımı yapmadan HER ZAMAN aynı genel sonucu döner
 * (e-posta enumeration'ı engellemek için) — bkz. app/api/auth/forgot-
 * password/route.ts. Mail gönderimi başarısız olursa (provider yapılandırılmamış
 * veya gönderim hatası) da route yine aynı genel mesajı döner; yalnız server
 * tarafında (içerik sızdırmadan) loglanır.
 */
export async function requestPasswordReset(input: { email: string }) {
  const email = input.email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, email: true },
  });

  if (!user || user.status !== "ACTIVE") {
    // Kullanıcı yok veya aktif değil — sessizce hiçbir şey yapma (enumeration
    // koruması), ama route katmanı yine de genel başarı mesajı döner.
    return { requested: false as const, emailDelivered: false as const };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await db.$transaction(async (tx) => {
    // Kullanıcının önceki AÇIK (kullanılmamış, süresi dolmamış) tokenlarını
    // geçersiz kıl — aynı anda yalnız bir aktif reset linki geçerli olsun.
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const settings = await getPlatformSettings().catch(() => getPlatformSettingsFallback());
  const websiteUrl = settings.websiteUrl?.trim() || "https://hesapisleri.com";
  const resetLink = `${websiteUrl}/reset-password?token=${rawToken}`;
  const { html, text } = buildResetEmail({ resetLink, brandName: settings.brandName });

  const result = await sendMail({
    to: user.email,
    subject: `${settings.brandName} — Şifre Sıfırlama`,
    html,
    text,
  });

  if (!result.ok) {
    // Mail gönderilemedi (provider yapılandırılmamış veya gönderim hatası).
    // Token DB'de kalır (kullanıcı tekrar deneyebilir, eski token bir
    // sonraki istekte otomatik geçersiz kılınır) — hiçbir zaman console'a
    // token/link yazılmaz, yalnız hata KODU loglanır (mail-service.ts).
    console.error("PASSWORD_RESET_EMAIL_NOT_DELIVERED", {
      userId: user.id,
      reason: result.reason,
    });
    return { requested: true as const, emailDelivered: false as const };
  }

  return { requested: true as const, emailDelivered: true as const };
}

export class PasswordResetTokenError extends Error {
  code: "INVALID_OR_EXPIRED";
  constructor() {
    super("Bağlantı geçersiz veya süresi dolmuş.");
    this.name = "PasswordResetTokenError";
    this.code = "INVALID_OR_EXPIRED";
  }
}

async function findValidTokenRecord(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return record;
}

export async function validatePasswordResetToken(rawToken: string) {
  const record = await findValidTokenRecord(rawToken);
  return { valid: Boolean(record) };
}

/**
 * Token'ı tüketip yeni şifreyi ayarlar. Tek transaction: token used işaretlenir
 * + şifre güncellenir + sessionVersion arttırılır (tüm mevcut oturumlar
 * geçersiz kılınır — şifre sıfırlandıktan sonra eski oturumların/JWT'lerin
 * geçerli kalması güvenlik açığıdır).
 */
export async function consumePasswordResetToken(input: {
  rawToken: string;
  newPassword: string;
}) {
  const record = await findValidTokenRecord(input.rawToken);
  if (!record) {
    throw new PasswordResetTokenError();
  }

  const hashedPassword = await hashPassword(input.newPassword);

  await db.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Eşzamanlı iki istek aynı token'ı tüketmeye çalışırsa (double submit),
    // yalnız ilki claimed.count===1 alır — ikincisi burada durur.
    if (claimed.count === 0) {
      throw new PasswordResetTokenError();
    }

    await tx.user.update({
      where: { id: record.userId },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
      },
    });
  });

  return { userId: record.userId };
}
