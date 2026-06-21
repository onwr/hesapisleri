import "server-only";

import { isIP } from "node:net";

function normalizeCandidate(value: string | null) {
  if (!value) return null;
  const candidate = value.split(",")[0]?.trim() ?? "";
  if (!candidate || candidate.length > 39) return null;
  return isIP(candidate) ? candidate : null;
}

export function getTrustedClientIp(request: Request) {
  const forwarded = normalizeCandidate(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = normalizeCandidate(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  return "127.0.0.1";
}

export function maskClientIp(value: string | null | undefined) {
  if (!value) return null;
  if (value.includes(":")) return `${value.slice(0, 6)}…`;
  const parts = value.split(".");
  if (parts.length !== 4) return "masked";
  return `${parts[0]}.${parts[1]}.x.x`;
}
