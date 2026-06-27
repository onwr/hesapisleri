import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listCampaignHistory } from "@/lib/admin/promotions/campaign-query-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const data = await listCampaignHistory(
      id,
      Number(searchParams.get("page") ?? 1),
      Number(searchParams.get("pageSize") ?? 25)
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Geçmiş yüklenemedi." },
      { status: 500 }
    );
  }
}
