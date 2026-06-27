import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError, activateCampaign } from "@/lib/admin/promotions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const campaign = await activateCampaign(auth.user.id, id, body);

    return NextResponse.json({
      success: true,
      message: "Kampanya aktifleştirildi.",
      data: campaign,
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Aktifleştirme başarısız." },
      { status: 500 }
    );
  }
}
