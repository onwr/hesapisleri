import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserMembershipError,
  adminUpdateCompanyMembership,
} from "@/lib/admin/users/admin-user-membership-service";

type RouteContext = { params: Promise<{ id: string; companyUserId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, companyUserId } = await context.params;
    const body = await req.json();
    const data = await adminUpdateCompanyMembership(id, companyUserId, auth.user.id, body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminUserMembershipError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_MEMBERSHIP_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Üyelik güncellenemedi." },
      { status: 500 }
    );
  }
}
