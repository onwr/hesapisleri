import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  createCompanyPriceOverride,
} from "@/lib/admin-subscription-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await createCompanyPriceOverride(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Özel fiyat tanımlandı.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTION_SPECIAL_PRICE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Özel fiyat kaydedilemedi." },
      { status: 500 }
    );
  }
}
