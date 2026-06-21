import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  updateSubscriptionAutoRenew,
} from "@/lib/admin-subscription-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await updateSubscriptionAutoRenew(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Otomatik yenileme güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTION_AUTO_RENEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Otomatik yenileme güncellenemedi." },
      { status: 500 }
    );
  }
}
