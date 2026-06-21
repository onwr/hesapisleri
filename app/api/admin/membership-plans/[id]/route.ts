import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  MembershipServiceError,
  updateMembershipPlan,
  updateMembershipPlanSchema,
} from "@/lib/membership-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = updateMembershipPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Paket bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const plan = await updateMembershipPlan(id, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Paket güncellendi.",
      data: { plan },
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_MEMBERSHIP_PLAN_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Paket güncellenemedi." },
      { status: 500 }
    );
  }
}
