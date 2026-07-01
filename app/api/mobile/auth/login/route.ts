import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/employee-pos-utils";
import { createMobileSession } from "@/lib/mobile/mobile-session-service";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().min(1, "E-posta zorunludur.").email("Geçersiz e-posta."),
  password: z.string().min(1, "Şifre zorunludur."),
  deviceInfo: z.string().max(500).optional(),
});

// IP adresini Next.js request'ten al
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Bilgileri kontrol edin.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email: emailOrUsername, password, deviceInfo } = parsed.data;

    // Rate limit: IP + normalize e-posta — 10 deneme / 5 dakika
    const ip = getClientIp(req);
    const normalizedEmail = emailOrUsername.toLowerCase().trim();
    const rateLimitKey = `mobile-login:${ip}:${normalizedEmail}`;

    const rl = await checkRateLimitAsync({
      key: rateLimitKey,
      limit: 10,
      windowMs: 5 * 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Çok fazla giriş denemesi. Lütfen bekleyin.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      );
    }

    let email: string;
    try {
      email = await resolveLoginEmail(emailOrUsername);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Giriş bilgileri çözümlenemedi." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        companyUsers: {
          where: { status: "ACTIVE" },
          include: { company: true },
          orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "E-posta veya şifre hatalı.", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "E-posta veya şifre hatalı.", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Hesabınız askıya alınmıştır.", code: "SUSPENDED_USER" }, { status: 403 });
    }

    // SUPER_ADMIN cannot use mobile app
    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Bu hesap mobil uygulamayı kullanamaz.", code: "FORBIDDEN" }, { status: 403 });
    }

    const activeMemberships = user.companyUsers.filter(
      (cu) => cu.company?.status === "ACTIVE"
    );
    const primaryMembership = activeMemberships[0] ?? null;

    // Update login tracking
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginTrackingStatus: "LOGGED_IN" },
    });

    // Re-read sessionVersion after update
    const freshUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sessionVersion: true },
    });
    const sv = freshUser?.sessionVersion ?? user.sessionVersion;

    const { accessToken, refreshToken } = await createMobileSession(
      user.id,
      primaryMembership?.companyId ?? null,
      sv,
      user.email,
      user.role,
      deviceInfo
    );

    return NextResponse.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      companies: activeMemberships.map((cu) => ({
        companyId: cu.companyId,
        companyName: cu.company?.name ?? "",
        role: cu.role,
        isOwner: cu.isOwner,
        subscriptionStatus: null, // Faz 2'de gerçek entegrasyon
        companyStatus: cu.company?.status ?? "ACTIVE",
      })),
      currentCompany: primaryMembership
        ? {
            companyId: primaryMembership.companyId,
            companyName: primaryMembership.company?.name ?? "",
            role: primaryMembership.role,
            isOwner: primaryMembership.isOwner,
            companyStatus: primaryMembership.company?.status ?? "ACTIVE",
          }
        : null,
    });
  } catch (err) {
    console.error("MOBILE_LOGIN_ERROR", err);
    return NextResponse.json({ error: "Giriş yapılırken bir hata oluştu." }, { status: 500 });
  }
}
