import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerApplicationServiceError,
  getPartnerApplicationDetail,
} from "@/lib/admin/partner-applications";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getPartnerApplicationDetail(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerApplicationServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Başvuru detayı yüklenemedi." },
      { status: 500 }
    );
  }
}
