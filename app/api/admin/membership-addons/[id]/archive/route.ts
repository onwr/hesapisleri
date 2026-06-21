import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, archiveAddOn } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const addOn = await archiveAddOn(id, auth.user.id);

    return NextResponse.json({
      success: true,
      message: "Ek paket arşivlendi.",
      data: addOn,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_ADDON_ARCHIVE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paket arşivlenemedi." },
      { status: 500 }
    );
  }
}
