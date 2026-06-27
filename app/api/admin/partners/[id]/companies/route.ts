import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminPartnerServiceError, listPartnerCompanies } from "@/lib/admin/partners";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const url = new URL(req.url);
    const data = await listPartnerCompanies(id, {
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
      q: url.searchParams.get("q") ?? undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Firmalar yüklenemedi." },
      { status: 500 }
    );
  }
}
