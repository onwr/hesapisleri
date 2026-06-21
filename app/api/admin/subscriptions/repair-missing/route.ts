import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSubscriptionError,
  repairMissingSubscriptions,
} from "@/lib/admin-subscription-service";

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    if (!body.confirm) {
      return NextResponse.json(
        {
          success: false,
          message: "Onay gerekli: confirm=true gönderin.",
        },
        { status: 400 }
      );
    }

    const result = await repairMissingSubscriptions({
      dryRun: false,
      confirm: true,
      companyId: body.companyId,
      limit: body.limit,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: `${result.created} abonelik oluşturuldu, ${result.skipped} atlandı.`,
      data: result,
    });
  } catch (error) {
    if (error instanceof AdminSubscriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_SUBSCRIPTION_REPAIR_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Onarım işlemi başarısız." },
      { status: 500 }
    );
  }
}
