import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserMembershipError,
  adminResendMembershipInvite,
} from "@/lib/admin/users/admin-user-membership-service";

type RouteContext = { params: Promise<{ id: string; companyUserId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, companyUserId } = await context.params;
    await adminResendMembershipInvite(id, companyUserId, auth.user.id);
  } catch (error) {
    if (error instanceof AdminUserMembershipError) {
      return NextResponse.json(
        { success: false, message: error.message, code: "MAIL_NOT_CONFIGURED" },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_MEMBERSHIP_RESEND_INVITE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Davet e-postası gönderilemedi." },
      { status: 500 }
    );
  }
}
