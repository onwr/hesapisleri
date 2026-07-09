import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { initializeSipayCheckout } from "@/lib/payments/sipay/sipay-checkout-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  planId: z.string().optional(),
  billingPeriod: z
    .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "SEMIANNUAL", "ANNUAL", "YEARLY"])
    .transform((v) =>
      v === "SEMIANNUAL" ? "SEMI_ANNUAL" : v === "ANNUAL" ? "YEARLY" : v,
    ),
  idempotencyKey: z.string().min(12).max(120),
});

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 },
      );
    }

    await assertCanManageActiveCompanyBilling({
      userId: session.user.id,
      activeCompanyId: session.company.id,
    });

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Ödeme bilgilerini kontrol edin.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await initializeSipayCheckout({
      companyId: session.company.id,
      userId: session.user.id,
      planId: parsed.data.planId,
      period: parsed.data.billingPeriod,
      idempotencyKey: parsed.data.idempotencyKey,
      payerIp: getTrustedClientIp(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      console.error("[sipay-checkout] error", {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[sipay-checkout] error", {
      message: error instanceof Error ? error.message : "unknown",
      status: 500,
    });
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Sipay ödeme başlatılamadı." },
      { status: 500 },
    );
  }
}
