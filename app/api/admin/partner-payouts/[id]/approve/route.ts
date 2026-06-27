import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  approvePartnerPayoutAdmin,
} from "@/lib/admin/partner-payouts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const payout = await approvePartnerPayoutAdmin(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Ödeme onaylandı.",
      data: { payout },
    });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Onay işlemi başarısız." },
      { status: 500 }
    );
  }
}
