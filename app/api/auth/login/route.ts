import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import { resolveLoginEmail } from "@/lib/employee-pos-utils";
import {
  getPostAuthRedirectPath,
  resolveEffectiveRole,
} from "@/lib/permission-utils";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";
import {
  checkAuthRateLimit,
  clearAuthRateLimit,
  registerAuthFailure,
} from "@/lib/auth/auth-rate-limit-service";

const loginSchema = z.object({
  email: z.string().min(1, "E-posta veya kullanıcı adı zorunludur."),
  password: z.string().min(1, "Şifre zorunludur."),
});

function tooManyAttemptsResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      message: `Çok fazla başarısız deneme. Lütfen ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} dakika sonra tekrar deneyin.`,
      code: "RATE_LIMITED",
      retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

function resolveLoginRedirectTo(input: {
  role: string;
  isOwner: boolean;
  hasActiveCompany: boolean;
}) {
  if (!input.hasActiveCompany) {
    return "/companies/select";
  }

  return getPostAuthRedirectPath(
    input.role as Parameters<typeof getPostAuthRedirectPath>[0],
    input.isOwner
  );
}

export async function POST(req: Request) {
  try {
    const clientIp = getTrustedClientIp(req);
    const rateLimit = await checkAuthRateLimit("login", clientIp);
    if (rateLimit.limited) {
      return tooManyAttemptsResponse(rateLimit.retryAfterSeconds);
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

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

    const { email: emailOrUsername, password } = parsed.data;

    let email: string;
    try {
      email = await resolveLoginEmail(emailOrUsername);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Giriş bilgileri çözümlenemedi.",
        },
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
      const failure = await registerAuthFailure("login", clientIp);
      if (failure.limited) {
        return tooManyAttemptsResponse(failure.retryAfterSeconds);
      }
      return NextResponse.json(
        {
          success: false,
          message: "E-posta veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      const failure = await registerAuthFailure("login", clientIp);
      if (failure.limited) {
        return tooManyAttemptsResponse(failure.retryAfterSeconds);
      }
      return NextResponse.json(
        {
          success: false,
          message: "E-posta veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    await clearAuthRateLimit("login", clientIp);

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Kullanıcı hesabınız aktif değil.",
        },
        { status: 403 }
      );
    }

    const activeMembership =
      user.companyUsers.find((entry) => entry.company?.status === "ACTIVE") ??
      null;
    const activeCompany = activeMembership?.company ?? null;
    const effectiveRole = activeMembership
      ? resolveEffectiveRole({
          role: activeMembership.role,
          isOwner: activeMembership.isOwner,
        })
      : user.role;

    const redirectTo = resolveLoginRedirectTo({
      role: effectiveRole,
      isOwner: activeMembership?.isOwner ?? false,
      hasActiveCompany: Boolean(activeCompany),
    });

    // lastLoginAt ve loginTrackingStatus güncellenir; sessionVersion okunur.
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginTrackingStatus: "LOGGED_IN",
      },
      select: { sessionVersion: true },
    });

    const response = NextResponse.json({
      success: true,
      message: "Giriş başarılı.",
      redirectTo,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        company: activeCompany
          ? {
              id: activeCompany.id,
              name: activeCompany.name,
              email: activeCompany.email,
              phone: activeCompany.phone,
            }
          : null,
        redirectTo,
      },
    });

    await attachAuthCookie(response, {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: activeCompany?.id ?? null,
      sv: updatedUser.sessionVersion,
    });

    return response;
  } catch (error) {
    console.error("LOGIN_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Giriş yapılırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
