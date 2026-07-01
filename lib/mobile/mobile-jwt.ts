import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "hesapisleri-secret";
const ACCESS_TOKEN_EXPIRY = "15m";

export type MobileTokenPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
  sv: number;
  sid: string; // MobileSession.id — live session doğrulama için
  type: "mobile-access";
  exp?: number;
  iat?: number;
};

export function signMobileAccessToken(
  payload: Omit<MobileTokenPayload, "type" | "exp" | "iat">
): string {
  return jwt.sign({ ...payload, type: "mobile-access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyMobileAccessToken(
  token: string
): MobileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MobileTokenPayload;
    if (decoded.type !== "mobile-access") return null;
    return decoded;
  } catch {
    return null;
  }
}
