import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PartnerServiceError,
  createPartnerPayoutAdmin,
  getAdminPartnerDetail,
  updatePartnerProfileAdmin,
} from "@/lib/partner-service";
import {
  createPartnerPayoutSchema,
  updatePartnerProfileAdminSchema,
} from "@/lib/partner-utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminPartnerDetail(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_PARTNER_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Partner detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = updatePartnerProfileAdminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Güncelleme bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const partner = await updatePartnerProfileAdmin(id, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Partner güncellendi.",
      data: { partner },
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_PARTNER_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Partner güncellenemedi." },
      { status: 500 }
    );
  }
}

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
