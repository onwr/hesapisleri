import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, publishAddOnPrice } from "@/lib/admin/addons";

type RouteContext = { params: Promise<{ id: string; priceId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, priceId } = await context.params;
    const price = await publishAddOnPrice({
      addOnId: id,
      priceId,
      actorUserId: auth.user.id,
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
    console.error("ADMIN_ADDON_PRICE_PUBLISH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fiyat yayınlanamadı." },
      { status: 500 }
    );
  }
}
