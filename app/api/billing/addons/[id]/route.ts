import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { cancelAddOnSubscription } from "@/lib/billing/addons/addon-purchase-service";
import { db } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    await assertCanManageActiveCompanyBilling({
      userId: session.user.id,
      activeCompanyId: session.company.id,
    });

    const { id } = await context.params;
    const body = await req.json();

    const sub = await db.companyAddOnSubscription.findFirst({
      where: { id, companyId: session.company.id },
    });
    if (!sub) {
      return NextResponse.json({ success: false, message: "Abonelik bulunamadı." }, { status: 404 });
    }

    const updated = await db.companyAddOnSubscription.update({
      where: { id: sub.id },
      data: { autoRenew: Boolean(body.autoRenew) },
    });

    return NextResponse.json({
      success: true,
      message: "Otomatik yenileme güncellendi.",
      data: updated,
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("BILLING_ADDON_AUTORENEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    await assertCanManageActiveCompanyBilling({
      userId: session.user.id,
      activeCompanyId: session.company.id,
    });

    const { id } = await context.params;
    const body = await req.json();
    const action = body.action as string;

    if (action === "reactivate") {
      const sub = await db.companyAddOnSubscription.findFirst({
        where: { id, companyId: session.company.id },
      });
      if (!sub) {
        return NextResponse.json({ success: false, message: "Abonelik bulunamadı." }, { status: 404 });
      }
      const updated = await db.companyAddOnSubscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: false, status: "ACTIVE", cancelledAt: null },
      });
      return NextResponse.json({
        success: true,
        message: "İptal geri alındı.",
        data: updated,
      });
    }

    const updated = await cancelAddOnSubscription({
      companyId: session.company.id,
      addOnSubscriptionId: id,
      atPeriodEnd: body.atPeriodEnd !== false,
    });

    return NextResponse.json({
      success: true,
      message:
        body.atPeriodEnd === false ? "Ek paket iptal edildi." : "Dönem sonunda iptal planlandı.",
      data: updated,
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("BILLING_ADDON_CANCEL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "İşlem başarısız." },
      { status: 500 }
    );
  }
}
