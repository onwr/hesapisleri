import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminUserActionError,
  adminSendUserPasswordReset,
} from "@/lib/admin/users/admin-user-action-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    await adminSendUserPasswordReset(id, auth.user.id);
  } catch (error) {
    if (error instanceof AdminUserActionError) {
      return NextResponse.json(
        { success: false, message: error.message, code: "MAIL_NOT_CONFIGURED" },
        { status: error.status }
      );
    }
    console.error("ADMIN_USER_RESET_PASSWORD_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Parola sıfırlama isteği işlenemedi." },
      { status: 500 }
    );
  }
}
