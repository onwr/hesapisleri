import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  createPartnerPayoutAdmin,
} from "@/lib/admin/partner-payouts";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id } = await context.params;
    const payout = await createPartnerPayoutAdmin(auth.user.id, body, id);

    return NextResponse.json({
      success: true,
      message: "Partner ödemesi oluşturuldu.",
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
      { success: false, message: "Ödeme oluşturulamadı." },
      { status: 500 }
    );
  }
}
