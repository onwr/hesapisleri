import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminJobDetail } from "@/lib/admin/jobs";

type RouteContext = { params: Promise<{ jobKey: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { jobKey } = await context.params;
    const job = await getAdminJobDetail(jobKey);

    if (!job) {
      return NextResponse.json(
        { success: false, message: "Job bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { job } });
  } catch {
    return NextResponse.json(
      { success: false, message: "Job detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
