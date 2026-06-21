import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { db } from "@/lib/prisma";
import { getPaytrCapabilities } from "@/lib/payments/paytr-capabilities";

const schema = z.object({ autoRenew: z.boolean() });

export async function PATCH(request: Request) {
  try {
    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Otomatik yenileme bilgisi geçersiz." },
        { status: 400 }
      );
    }

    const paytrCapabilities = getPaytrCapabilities();

    if (parsed.data.autoRenew && !paytrCapabilities.autoRenewAvailable) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Otomatik yenileme yalnız PayTR Direct API + kart saklama + recurring + non-3D ile kullanılabilir.",
        },
        { status: 503 }
      );
    }

    const subscription = await db.companySubscription.findUnique({
      where: { companyId: session.company.id },
      include: { defaultPaymentMethod: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "Üyelik kaydı bulunamadı." },
        { status: 404 }
      );
    }

    if (parsed.data.autoRenew) {
      if (!subscription.defaultPaymentMethod) {
        return NextResponse.json(
          {
            success: false,
            message: "Otomatik yenileme için aktif kayıtlı kart gerekli.",
          },
          { status: 400 }
        );
      }
    }

    const updated = await db.companySubscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: parsed.data.autoRenew,
        nextBillingAt: parsed.data.autoRenew
          ? subscription.currentPeriodEnd
          : null,
      },
    });

    await db.activityLog.create({
      data: {
        companyId: session.company.id,
        userId: session.user.id,
        action: "UPDATE",
        module: "settings",
        message: parsed.data.autoRenew
          ? "Otomatik üyelik yenileme açıldı."
          : "Otomatik üyelik yenileme kapatıldı.",
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Otomatik yenileme güncellenemedi.",
      },
      { status: 500 }
    );
  }
}
