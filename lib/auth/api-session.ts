import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getAuthToken, verifySessionToken } from "@/lib/auth";
import type { SessionTokenPayload } from "@/lib/auth/jwt";
import { db } from "@/lib/prisma";

type ApiSessionPayload = SessionTokenPayload & {
  userId: string;
  companyId?: string | null;
  sv?: number;
};

export type ValidatedApiSession = {
  userId: string;
  companyId: string | null;
  user: User;
};

export function createApiUnauthorizedResponse(message = "Oturum bulunamadı.") {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function createApiSessionRevokedResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.",
      code: "SESSION_REVOKED",
    },
    { status: 401 }
  );
}

export async function validateAuthenticatedApiSessionFromToken(
  token: string | null | undefined
): Promise<
  | { ok: true; session: ValidatedApiSession }
  | { ok: false; response: NextResponse }
> {
  if (!token) {
    return { ok: false, response: createApiUnauthorizedResponse() };
  }

  const payload = verifySessionToken<ApiSessionPayload>(token);

  if (!payload?.userId) {
    return {
      ok: false,
      response: createApiUnauthorizedResponse("Oturum geçersiz."),
    };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    return {
      ok: false,
      response: createApiUnauthorizedResponse("Kullanıcı bulunamadı."),
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Kullanıcı hesabınız aktif değil." },
        { status: 403 }
      ),
    };
  }

  if (payload.sv === undefined || payload.sv !== user.sessionVersion) {
    return { ok: false, response: createApiSessionRevokedResponse() };
  }

  return {
    ok: true,
    session: {
      userId: payload.userId,
      companyId: payload.companyId ?? null,
      user,
    },
  };
}

export async function resolveAuthenticatedApiSession() {
  const token = await getAuthToken();
  return validateAuthenticatedApiSessionFromToken(token);
}
