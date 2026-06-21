import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  getAdminSubscriptionDetail,
} from "@/lib/admin-subscription-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminSubscriptionDetail(id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTION_DETAIL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Abonelik detayı yüklenemedi." },
      { status: 500 }
    );
  }
}
