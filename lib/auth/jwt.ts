import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "hesapisleri-secret";

export type SessionTokenPayload = {
  userId: string;
  email?: string;
  role?: string;
  companyId?: string | null;
  exp?: number;
  iat?: number;
};

export function signSessionToken(payload: Omit<SessionTokenPayload, "exp" | "iat">) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifySessionToken<T extends SessionTokenPayload = SessionTokenPayload>(
  token: string
): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch {
    return null;
  }
}

export function decodeSessionToken<T extends SessionTokenPayload = SessionTokenPayload>(
  token: string
): T | null {
  try {
    return jwt.decode(token) as T | null;
  } catch {
    return null;
  }
}

export function isSessionExpired(payload: Pick<SessionTokenPayload, "exp"> | null) {
  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
}
