import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { db } from "@/lib/prisma";
import { initializePaytrMembershipPayment } from "@/lib/payments/payment-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  idempotencyKey: z.string().min(12).max(120),
  autoRenew: z.boolean().default(false),
  saveCard: z.boolean().default(false),
  consentVersion: z.string().max(80).optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
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
        { success: false, message: "Retry bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const payment = await db.membershipPayment.findFirst({
      where: { id, companyId: session.company.id },
    });

    if (!payment || !payment.period) {
      return NextResponse.json(
        { success: false, message: "Ödeme kaydı bulunamadı." },
        { status: 404 }
      );
    }

    if (["CREATED", "FORM_READY", "PENDING", "WAIT_CALLBACK", "UNKNOWN"].includes(payment.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu ödeme halen sonuç bekliyor. Yeni deneme oluşturulmadı.",
        },
        { status: 409 }
      );
    }

    const result = await initializePaytrMembershipPayment({
      companyId: session.company.id,
      userId: session.user.id,
      planId: payment.planId ?? undefined,
      period: payment.period,
      autoRenew: parsed.data.autoRenew,
      saveCard: parsed.data.saveCard,
      consentVersion: parsed.data.consentVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      payerIp: getTrustedClientIp(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Ödeme tekrar denenemedi.",
      },
      { status: 500 }
    );
  }
}
