import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, createAddOnPrice } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const price = await createAddOnPrice(id, auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Fiyat oluşturuldu.",
      data: price,
    });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Fiyat oluşturulamadı." },
      { status: 500 }
    );
  }
}
