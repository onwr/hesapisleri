import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { listPurchasableAddOns } from "@/lib/billing/addons/addon-purchase-service";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    const [addOns, activeSubs] = await Promise.all([
      listPurchasableAddOns(session.company.id),
      db.companyAddOnSubscription.findMany({
        where: {
          companyId: session.company.id,
          status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END", "PENDING", "PAST_DUE"] },
        },
        include: { addOn: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { purchasable: addOns, active: activeSubs },
    });
  } catch (error) {
    console.error("BILLING_ADDONS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ek paketler yüklenemedi." },
      { status: 500 }
    );
  }
}
