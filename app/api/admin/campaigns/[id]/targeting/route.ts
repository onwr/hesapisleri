import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  getCampaignDetail,
  updateCampaignTargeting,
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

    return NextResponse.json({
      success: true,
      data: {
        scopes: data.campaign.scopes,
        firstPaymentOnly: data.campaign.firstPaymentOnly,
        renewalAllowed: data.campaign.renewalAllowed,
        newCustomersOnly: data.campaign.newCustomersOnly,
        existingCustomersAllowed: data.campaign.existingCustomersAllowed,
        minimumAmountMinor: data.campaign.minimumAmountMinor,
        maxRedemptions: data.campaign.maxRedemptions,
        maxRedemptionsPerCompany: data.campaign.maxRedemptionsPerCompany,
        currency: data.campaign.currency,
        autoApply: data.campaign.autoApply,
        stackable: data.campaign.stackable,
        priority: data.campaign.priority,
        status: data.campaign.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Hedefleme yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const campaign = await updateCampaignTargeting(auth.user.id, id, body);

    return NextResponse.json({
      success: true,
      message: "Kampanya hedeflemesi güncellendi.",
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
      { success: false, message: "Hedefleme güncellenemedi." },
      { status: 500 }
    );
  }
}
