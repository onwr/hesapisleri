import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "./mobile-auth-guards";
import { MobileCatalogError } from "./mobile-catalog-errors";
import { MobileFinanceError } from "./mobile-finance-errors";

export function handleMobileRouteError(err: unknown) {
  if (err instanceof MobileAuthError) {
    return mobileErrorResponse(err.code, err.message, err.status);
  }
  if (err instanceof MobileCatalogError || err instanceof MobileFinanceError) {
    const e = err;
    return NextResponse.json(
      {
        error: e.message,
        code: e.code,
        ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
      },
      { status: e.status }
    );
  }
  console.error("[mobile] hata:", err);
  return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
}

export async function requireMobileCompanySession(request: Request) {
  const session = await requireMobileApiSession(request);
  if (!session.companyId) {
    throw new MobileAuthError("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
  }
  const membership = await requireMobileCompanyContext(session, session.companyId);
  return { session, membership, companyId: session.companyId };
}

export function mobileJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
