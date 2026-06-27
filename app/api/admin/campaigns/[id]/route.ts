import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  getCampaignDetail,
  updateCampaign,
} from "@/lib/admin/promotions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getCampaignDetail(id);
    if (!data) {
      return NextResponse.json(
        { success: false, message: "Kampanya bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Kampanya yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const campaign = await updateCampaign(auth.user.id, id, body);

    return NextResponse.json({
      success: true,
      message: "Kampanya güncellendi.",
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
      { success: false, message: "Kampanya güncellenemedi." },
      { status: 500 }
    );
  }
}
