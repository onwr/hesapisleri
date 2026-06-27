import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerApplicationServiceError,
  approvePartnerApplicationAdmin,
} from "@/lib/admin/partner-applications";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const result = await approvePartnerApplicationAdmin(id, auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    if (error instanceof AdminPartnerApplicationServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Başvuru onaylanamadı." },
      { status: 500 }
    );
  }
}
