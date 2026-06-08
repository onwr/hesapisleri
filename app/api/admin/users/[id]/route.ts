import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminServiceError,
  getAdminUserDetail,
  updateAdminUser,
} from "@/lib/admin-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminUserDetail(id);

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_USER_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcı detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await updateAdminUser(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Kullanıcı güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_USER_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcı güncellenemedi." },
      { status: 500 }
    );
  }
}
