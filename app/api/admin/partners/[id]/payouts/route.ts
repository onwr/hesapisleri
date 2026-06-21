import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PartnerServiceError,
  createPartnerPayoutAdmin,
} from "@/lib/partner-service";
import { createPartnerPayoutSchema } from "@/lib/partner-utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = createPartnerPayoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Ödeme bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const payout = await createPartnerPayoutAdmin({
      partnerId: id,
      earningIds: parsed.data.earningIds,
      paymentMethod: parsed.data.paymentMethod,
      note: parsed.data.note,
      markPaid: parsed.data.markPaid,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Partner ödemesi oluşturuldu.",
      data: { payout },
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_PARTNER_PAYOUT_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ödeme oluşturulamadı." },
      { status: 500 }
    );
  }
}
