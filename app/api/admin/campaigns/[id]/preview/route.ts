import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError } from "@/lib/admin/promotions";
import { adminCampaignPreviewSchema } from "@/lib/admin/campaigns/admin-campaign-schemas";
import { previewCampaignPrice } from "@/lib/admin/campaigns/admin-campaign-preview-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const parsed = adminCampaignPreviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz önizleme isteği." },
        { status: 400 }
      );
    }

    const preview = await previewCampaignPrice(id, parsed.data);

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Fiyat önizlemesi yapılamadı." },
      { status: 500 }
    );
  }
}
