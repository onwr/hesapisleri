import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listAddOnCompanies } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const data = await listAddOnCompanies(id, page);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_ADDON_COMPANIES_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Firma listesi yüklenemedi." },
      { status: 500 }
    );
  }
}
