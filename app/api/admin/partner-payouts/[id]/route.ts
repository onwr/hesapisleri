import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerPayoutServiceError,
  getPartnerPayoutDetail,
} from "@/lib/admin/partner-payouts";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const detail = await getPartnerPayoutDetail(id);

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ödeme detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, message: "Generic status PATCH desteklenmez." },
    { status: 405 }
  );
}
