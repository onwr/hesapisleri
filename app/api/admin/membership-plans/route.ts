import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listMembershipPlans } from "@/lib/membership-service";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const plans = await listMembershipPlans();

    return NextResponse.json({ success: true, data: { plans } });
  } catch (error) {
    console.error("ADMIN_MEMBERSHIP_PLANS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Paketler yüklenemedi." },
      { status: 500 }
    );
  }
}
