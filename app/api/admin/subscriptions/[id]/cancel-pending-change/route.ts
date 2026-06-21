import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  cancelSubscriptionPendingChange,
} from "@/lib/admin-subscription-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await cancelSubscriptionPendingChange(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Planlanan değişiklik iptal edildi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Planlanan değişiklik iptal edilemedi.";
    console.error("ADMIN_SUBSCRIPTION_CANCEL_PENDING_CHANGE_ERROR", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
