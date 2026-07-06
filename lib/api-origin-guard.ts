import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getAllowedMutationOrigins() {
  const origins = new Set<string>();

  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.WEBSITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.SIPAY_RETURN_URL,
    process.env.SIPAY_CANCEL_URL,
    process.env.PAYTR_OK_URL,
    process.env.PAYTR_FAIL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // ignore invalid env URL
    }
  }

  return [...origins];
}

export function isAllowedMutationOrigin(origin: string | null, referer: string | null) {
  const allowed = getAllowedMutationOrigins();

  if (origin) {
    return allowed.includes(origin);
  }

  if (referer) {
    try {
      return allowed.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}

export function verifyApiMutationOrigin(req: Request) {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const method = req.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) {
    return null;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (isAllowedMutationOrigin(origin, referer)) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      message: "İstek kaynağı doğrulanamadı.",
      code: "CSRF_ORIGIN_REJECTED",
    },
    { status: 403 }
  );
}
