import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserActionError,
  adminSuspendUser,
} from "@/lib/admin/users/admin-user-action-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await adminSuspendUser(id, auth.user.id, body);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminUserActionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_SUSPEND_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kullanıcı askıya alınamadı." },
      { status: 500 }
    );
  }
}
