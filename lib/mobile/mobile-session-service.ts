import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/prisma";
import { signMobileAccessToken } from "./mobile-jwt";

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export interface MobileSessionResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export async function createMobileSession(
  userId: string,
  companyId: string | null,
  sv: number,
  email: string,
  role: string,
  deviceInfo?: string
): Promise<MobileSessionResult> {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const session = await db.mobileSession.create({
    data: { userId, tokenHash, companyId, sessionVersion: sv, expiresAt, deviceInfo: deviceInfo ?? null },
  });

  const accessToken = signMobileAccessToken({
    userId,
    email,
    role,
    companyId,
    sv,
    sid: session.id,
  });

  return { accessToken, refreshToken, sessionId: session.id };
}

export async function refreshMobileSession(
  refreshToken: string
): Promise<MobileSessionResult> {
  const tokenHash = hashToken(refreshToken);
  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  // Transaction: revoke + create atomik — create başarısız olursa revoke geri alınır
  const { newSession, user } = await db.$transaction(async (tx) => {
    // Atomik revoke: yalnız biri revokedAt null olan session'ı revoke edebilir
    // Paralel istek aynı token kullanırsa count === 0 → INVALID
    const revokeResult = await tx.mobileSession.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });

    if (revokeResult.count === 0) {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    const session = await tx.mobileSession.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) throw new Error("INVALID_REFRESH_TOKEN");

    const u = session.user;

    if (u.status !== "ACTIVE") {
      throw new Error("USER_SUSPENDED");
    }

    // sessionVersion check — session oluşturulduğundaki sv ile güncel DB sv karşılaştır
    if (u.sessionVersion !== session.sessionVersion) {
      throw new Error("SESSION_VERSION_MISMATCH");
    }

    const created = await tx.mobileSession.create({
      data: {
        userId: u.id,
        tokenHash: newTokenHash,
        companyId: session.companyId,
        sessionVersion: u.sessionVersion,
        expiresAt,
        deviceInfo: session.deviceInfo,
      },
    });

    return { newSession: created, user: u };
  });

  const accessToken = signMobileAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: newSession.companyId,
    sv: user.sessionVersion,
    sid: newSession.id,
  });

  return { accessToken, refreshToken: newRefreshToken, sessionId: newSession.id };
}

export async function revokeMobileSession(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await db.mobileSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeMobileSessionById(sessionId: string): Promise<void> {
  await db.mobileSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserMobileSessions(userId: string): Promise<void> {
  await db.mobileSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
