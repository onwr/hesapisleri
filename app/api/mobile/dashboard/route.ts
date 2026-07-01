import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { getMobileDashboard } from "@/lib/mobile/mobile-dashboard-service";

export async function GET(request: Request) {
  try {
    const session = await requireMobileApiSession(request);

    if (!session.companyId) {
      return mobileErrorResponse("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
    }

    const membership = await requireMobileCompanyContext(session, session.companyId);
    const data = await getMobileDashboard(session, membership);

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    console.error("[mobile/dashboard] hata:", err);
    return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
  }
}
