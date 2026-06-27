import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminPartnerServiceError, suspendPartner } from "@/lib/admin/partners";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const partner = await suspendPartner(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Partner askıya alındı.",
      data: partner,
    });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Askıya alma başarısız." },
      { status: 500 }
    );
  }
}
