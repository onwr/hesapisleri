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
  } catch {
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
    const updated = await updateAddOn(id, auth.user.id, await req.json());

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
    return NextResponse.json(
      { success: false, message: "Ek paket güncellenemedi." },
      { status: 500 }
    );
  }
}
