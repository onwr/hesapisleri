import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { verifyMobileAccessToken, type MobileTokenPayload } from "./mobile-jwt";
import { canAccessModule, type AppModule } from "@/lib/permission-utils";
import { mobileRoleAllows, type MobileModule, type MobileAction } from "./mobile-permission-policy";

export type MobileSession = MobileTokenPayload;

export class MobileAuthError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "MobileAuthError";
    this.code = code;
    this.status = status;
  }
}

export function mobileErrorResponse(
  code: string,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export async function requireMobileApiSession(
  request: Request
): Promise<MobileSession> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new MobileAuthError("UNAUTHORIZED", "Authorization header gerekli.", 401);
  }

  const token = authHeader.slice(7);
  const payload = verifyMobileAccessToken(token);

  if (!payload) {
    throw new MobileAuthError("SESSION_EXPIRED", "Token geçersiz veya süresi dolmuş.", 401);
  }

  // Live session kontrolü — logout sonrası access token anında reddedilir
  if (payload.sid) {
    const liveSession = await db.mobileSession.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true, userId: true },
    });

    if (!liveSession) {
      throw new MobileAuthError("SESSION_EXPIRED", "Oturum bulunamadı.", 401);
    }

    if (liveSession.revokedAt !== null) {
      throw new MobileAuthError("SESSION_EXPIRED", "Oturum sonlandırıldı.", 401);
    }

    if (liveSession.expiresAt < new Date()) {
      throw new MobileAuthError("SESSION_EXPIRED", "Oturum süresi doldu.", 401);
    }

    // userId token ile session arasında eşleşmeli
    if (liveSession.userId !== payload.userId) {
      throw new MobileAuthError("UNAUTHORIZED", "Token kullanıcı uyuşmazlığı.", 401);
    }
  }

  // Live user status + sessionVersion check
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { status: true, sessionVersion: true },
  });

  if (!user) {
    throw new MobileAuthError("UNAUTHORIZED", "Kullanıcı bulunamadı.", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new MobileAuthError("SUSPENDED_USER", "Hesabınız askıya alınmıştır.", 403);
  }

  if (user.sessionVersion !== payload.sv) {
    throw new MobileAuthError("SESSION_EXPIRED", "Oturum sonlandırıldı.", 401);
  }

  return payload;
}

export async function requireMobileCompanyContext(
  session: MobileSession,
  companyId: string
): Promise<{ company: { id: string; name: string; status: string }; role: string; isOwner: boolean }> {
  const membership = await db.companyUser.findFirst({
    where: {
      userId: session.userId,
      companyId,
      status: "ACTIVE",
    },
    include: { company: true },
  });

  if (!membership || !membership.company) {
    throw new MobileAuthError("COMPANY_NOT_FOUND", "Firma üyeliği bulunamadı.", 403);
  }

  if (membership.company.status !== "ACTIVE") {
    throw new MobileAuthError("COMPANY_INACTIVE", "Firma aktif değil.", 403);
  }

  return {
    company: membership.company,
    role: membership.role,
    isOwner: membership.isOwner,
  };
}

export type { MobileModule, MobileAction };

export async function requireMobilePermission(
  session: MobileSession,
  module: MobileModule,
  action: MobileAction
): Promise<{ role: string; isOwner: boolean }> {
  // SUPER_ADMIN tenant kapsamında mobil kullanamaz (login'de bloklanır)
  // Burada savunma katmanı olarak ek kontrol
  if (session.role === "SUPER_ADMIN") {
    throw new MobileAuthError("FORBIDDEN", "Super Admin mobil erişimi kullanamaz.", 403);
  }

  if (!session.companyId) {
    throw new MobileAuthError("COMPANY_REQUIRED", "Firma seçimi gereklidir.", 403);
  }

  // Live membership doğrulama — token companyId'sine güvenilmez, DB'den kontrol
  const membership = await db.companyUser.findFirst({
    where: {
      userId: session.userId,
      companyId: session.companyId,
      status: "ACTIVE",
    },
    include: { company: { select: { status: true } } },
  });

  if (!membership) {
    throw new MobileAuthError("COMPANY_NOT_FOUND", "Firma üyeliği bulunamadı.", 403);
  }

  if (membership.company?.status !== "ACTIVE") {
    throw new MobileAuthError("COMPANY_INACTIVE", "Firma aktif değil.", 403);
  }

  const role = membership.role as string;

  // "read" eşiği için canonical web permission-utils (business rule tekrarı yok)
  // AppModule eşlemesi: company → settings-users, diğerleri birebir
  const canonicalModule = (module === "company" ? "settings-users" : module) as AppModule;
  if (action === "read" && !canAccessModule(membership.role, canonicalModule, membership.isOwner)) {
    throw new MobileAuthError("FORBIDDEN", `${role} rolü ${module}/read işlemini yapamaz.`, 403);
  }

  // write/delete/admin için merkezi mobile action policy (mobile-permission-policy.ts)
  if (!mobileRoleAllows(role, module, action)) {
    throw new MobileAuthError("FORBIDDEN", `${role} rolü ${module}/${action} işlemini yapamaz.`, 403);
  }

  return { role, isOwner: membership.isOwner };
}
