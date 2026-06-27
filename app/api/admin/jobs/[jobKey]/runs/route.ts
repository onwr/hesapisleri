import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listAdminJobRuns } from "@/lib/admin/jobs";

type RouteContext = { params: Promise<{ jobKey: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { jobKey } = await context.params;
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

    const data = await listAdminJobRuns(
      jobKey,
      Number.isFinite(page) && page > 0 ? page : 1,
      Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25
    );

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Job bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "Run geçmişi yüklenemedi." },
      { status: 500 }
    );
  }
}
