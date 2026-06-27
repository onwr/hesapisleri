import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, activateAddOn } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const addOn = await activateAddOn(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Ek paket aktifleştirildi.",
      data: addOn,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ek paket aktifleştirilemedi." },
      { status: 500 }
    );
  }
}
