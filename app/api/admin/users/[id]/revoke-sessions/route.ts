import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserActionError,
  adminRevokeUserSessions,
} from "@/lib/admin/users/admin-user-action-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await adminRevokeUserSessions(id, auth.user.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminUserActionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_REVOKE_SESSIONS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Oturumlar iptal edilemedi." },
      { status: 500 }
    );
  }
}
