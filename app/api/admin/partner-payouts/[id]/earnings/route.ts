import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  listPayoutEarnings,
} from "@/lib/admin/partner-payouts";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const earnings = await listPayoutEarnings(id);

    return NextResponse.json({ success: true, data: { earnings } });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Hak edişler yüklenemedi." },
      { status: 500 }
    );
  }
}
