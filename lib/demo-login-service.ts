import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import {
  getPostAuthRedirectPath,
  resolveEffectiveRole,
} from "@/lib/permission-utils";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isDemoLoginEnabled() {
  return (
    process.env.DEMO_LOGIN_ENABLED === "true" &&
    Boolean(process.env.DEMO_LOGIN_EMAIL) &&
    Boolean(process.env.DEMO_LOGIN_PASSWORD)
  );
}

function getClientKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function performDemoLogin(req: Request) {
  if (!isDemoLoginEnabled()) {
    return {
      ok: false as const,
      status: 404,
      message: "Demo giriş kullanılamıyor.",
    };
  }

  const clientKey = getClientKey(req);
  if (!checkRateLimit(clientKey)) {
    return {
      ok: false as const,
      status: 429,
      message: "Çok fazla deneme. Lütfen biraz bekleyin.",
    };
  }

  const email = process.env.DEMO_LOGIN_EMAIL!.trim().toLowerCase();
  const password = process.env.DEMO_LOGIN_PASSWORD!;

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

  if (!user || user.status !== "ACTIVE") {
    return {
      ok: false as const,
      status: 401,
      message: "Demo giriş başarısız.",
    };
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    return {
      ok: false as const,
      status: 401,
      message: "Demo giriş başarısız.",
    };
  }

  const membership =
    user.companyUsers.find((entry) => entry.company?.status === "ACTIVE") ?? null;

  if (!membership?.company) {
    return {
      ok: false as const,
      status: 403,
      message: "Demo tenant kullanılamıyor.",
    };
  }

  const effectiveRole = resolveEffectiveRole({
    role: membership.role,
    isOwner: membership.isOwner,
  });

  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      loginTrackingStatus: "LOGGED_IN",
    },
    select: { sessionVersion: true },
  });

  const redirectTo = getPostAuthRedirectPath(effectiveRole, membership.isOwner);

  const response = NextResponse.json({
    success: true,
    message: "Demo giriş başarılı.",
    redirectTo,
    data: { redirectTo },
  });

  await attachAuthCookie(response, {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: membership.companyId,
    sv: updatedUser.sessionVersion,
  });

  return {
    ok: true as const,
    response,
    redirectTo,
  };
}
