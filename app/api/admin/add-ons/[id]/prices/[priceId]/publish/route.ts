import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, publishAddOnPrice } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string; priceId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, priceId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const price = await publishAddOnPrice({
      addOnId: id,
      priceId,
      actorUserId: auth.user.id,
      body,
    });

    return NextResponse.json({
      success: true,
      message: "Fiyat yayınlandı.",
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
      { success: false, message: "Fiyat yayınlanamadı." },
      { status: 500 }
    );
  }
}
