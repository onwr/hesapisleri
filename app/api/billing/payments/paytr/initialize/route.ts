import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { initializePaytrMembershipPayment } from "@/lib/payments/payment-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initializeSchema = z.object({
  planId: z.string().optional(),
  billingPeriod: z
    .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "SEMIANNUAL", "ANNUAL", "YEARLY"])
    .transform((value) =>
      value === "SEMIANNUAL" ? "SEMI_ANNUAL" : value === "ANNUAL" ? "YEARLY" : value
    ),
  autoRenew: z.boolean().default(false),
  saveCard: z.boolean().default(false),
  consentVersion: z.string().max(80).optional(),
  idempotencyKey: z.string().min(12).max(120),
  couponCode: z.string().max(40).optional(),
  forceNew: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (
      !canManageMembership(
        session.effectiveRole,
        session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    await assertCanManageActiveCompanyBilling({
      userId: session.user.id,
      activeCompanyId: session.company.id,
    });

    const parsed = initializeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Ödeme bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await initializePaytrMembershipPayment({
      companyId: session.company.id,
      userId: session.user.id,
      planId: parsed.data.planId,
      period: parsed.data.billingPeriod,
      autoRenew: parsed.data.autoRenew,
      saveCard: parsed.data.saveCard,
      consentVersion: parsed.data.consentVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      couponCode: parsed.data.couponCode,
      payerIp: getTrustedClientIp(request),
      forceNew: parsed.data.forceNew,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "PayTR ödeme başlatılamadı.",
      },
      { status: 500 }
    );
  }
}
