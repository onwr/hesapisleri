import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  createCampaign,
  getCampaignSummary,
  listCampaigns,
} from "@/lib/admin/promotions";
import { parseCampaignApiFilters } from "@/lib/admin/campaigns/admin-campaign-route-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const filters = parseCampaignApiFilters(new URL(req.url).searchParams);
    const [list, summary] = await Promise.all([listCampaigns(filters), getCampaignSummary()]);

    return NextResponse.json({ success: true, data: { ...list, summary } });
  } catch (error) {
    console.error("ADMIN_CAMPAIGNS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kampanyalar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const campaign = await createCampaign(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Kampanya taslak olarak oluşturuldu.",
      data: campaign,
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_CAMPAIGN_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kampanya oluşturulamadı." },
      { status: 500 }
    );
  }
}
