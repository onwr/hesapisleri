import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  listAdminSubscriptions,
  getAdminSubscriptionsSummary,
} from "@/lib/admin-subscription-service";
import { parseAdminSubscriptionFilters } from "@/lib/admin-subscription-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const filters = parseAdminSubscriptionFilters(params);
    const [list, summary] = await Promise.all([
      listAdminSubscriptions(filters),
      getAdminSubscriptionsSummary(),
    ]);

    return NextResponse.json({
      success: true,
      data: { ...list, summary },
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTIONS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Abonelikler yüklenemedi." },
      { status: 500 }
    );
  }
}
