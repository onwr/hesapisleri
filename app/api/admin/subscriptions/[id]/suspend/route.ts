import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  suspendSubscription,
} from "@/lib/admin-subscription-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await suspendSubscription(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Abonelik askıya alındı.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTION_SUSPEND_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Abonelik askıya alınamadı." },
      { status: 500 }
    );
  }
}
