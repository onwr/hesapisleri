import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  listPayoutHistory,
} from "@/lib/admin/partner-payouts";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25);

    const data = await listPayoutHistory(id, page, pageSize);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Geçmiş yüklenemedi." },
      { status: 500 }
    );
  }
}
