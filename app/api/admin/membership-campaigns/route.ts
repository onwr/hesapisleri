import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  createCampaign,
  getCampaignSummary,
  listCampaigns,
} from "@/lib/admin/promotions";
import type { CampaignListFilters } from "@/lib/admin/promotions";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });

    const filters: CampaignListFilters = {
      q: params.q,
      status: params.status as CampaignListFilters["status"],
      discountType: params.discountType as CampaignListFilters["discountType"],
      planId: params.planId,
      interval: params.interval as CampaignListFilters["interval"],
      autoApply: params.autoApply as CampaignListFilters["autoApply"],
      renewalAllowed: params.renewalAllowed as CampaignListFilters["renewalAllowed"],
      startsFrom: params.startsFrom,
      startsTo: params.startsTo,
      sort: (params.sort as CampaignListFilters["sort"]) ?? "startsAt",
      order: (params.order as CampaignListFilters["order"]) ?? "desc",
      page: Math.max(1, Number(params.page ?? 1) || 1),
    };

    const [list, summary] = await Promise.all([
      listCampaigns(filters),
      getCampaignSummary(),
    ]);

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
      message: "Kampanya oluşturuldu.",
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
