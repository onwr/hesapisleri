import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { setDefaultPaymentMethod } from "@/lib/payments/payment-method-service";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";

const schema = z.object({ paymentMethodId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const session = await getAppSession();
    if (
      !canManageMembership(session.effectiveRole, session.companyUser.isOwner)
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

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Kart bilgisini kontrol edin." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await setDefaultPaymentMethod({
        companyId: session.company.id,
        paymentMethodId: parsed.data.paymentMethodId,
      }),
    });
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
          error instanceof Error ? error.message : "Varsayılan kart değiştirilemedi.",
      },
      { status: 500 }
    );
  }
}
