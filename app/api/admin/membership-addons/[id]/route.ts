import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, getAddOnDetail, updateAddOn } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const detail = await getAddOnDetail(id);
    if (!detail) {
      return NextResponse.json({ success: false, message: "Ek paket bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error("ADMIN_ADDON_DETAIL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paket yüklenemedi." },
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
    const updated = await updateAddOn(id, { ...body, actorUserId: auth.user.id });

    return NextResponse.json({
      success: true,
      message: "Ek paket güncellendi.",
      data: updated,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_ADDON_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paket güncellenemedi." },
      { status: 500 }
    );
  }
}
