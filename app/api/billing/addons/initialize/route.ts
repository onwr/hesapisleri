import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { initializeAddOnPurchase } from "@/lib/billing/addons/addon-purchase-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

const schema = z.object({
  addOnId: z.string().min(1),
  quantity: z.number().int().min(1).max(100).default(1),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).optional(),
  autoRenew: z.boolean().default(false),
  saveCard: z.boolean().default(false),
  idempotencyKey: z.string().min(12).max(120),
});

export async function POST(request: Request) {
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

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await initializeAddOnPurchase({
      companyId: session.company.id,
      userId: session.user.id,
      addOnId: parsed.data.addOnId,
      quantity: parsed.data.quantity,
      billingInterval: parsed.data.billingInterval ?? null,
      autoRenew: parsed.data.autoRenew,
      saveCard: parsed.data.saveCard,
      idempotencyKey: parsed.data.idempotencyKey,
      payerIp: getTrustedClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Ödeme başlatıldı.",
      data: result,
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("BILLING_ADDON_INIT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ödeme başlatılamadı." },
      { status: 500 }
    );
  }
}
