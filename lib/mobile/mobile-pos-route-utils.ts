import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";

export function handleMobilePosRouteError(err: unknown) {
  if (err instanceof MobileAuthError) {
    return mobileErrorResponse(err.code, err.message, err.status);
  }
  if (err instanceof MobilePosError) {
    return mobileErrorResponse(err.code, err.message, err.status);
  }
  console.error("[mobile/pos] hata:", err);
  return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
}

export async function requireMobilePosSession(request: Request) {
  const session = await requireMobileApiSession(request);
  if (!session.companyId) {
    throw new MobileAuthError("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
  }
  const membership = await requireMobileCompanyContext(session, session.companyId);
  return { session, membership, companyId: session.companyId };
}

export function mobilePosJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
