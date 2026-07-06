import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { resumePaytrMembershipPayment } from "@/lib/payments/payment-service";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
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

    const { id } = await params;
    const result = await resumePaytrMembershipPayment({
      companyId: session.company.id,
      paymentId: id,
      payerIp: getTrustedClientIp(_request),
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
          error instanceof Error ? error.message : "Ödeme devam ettirilemedi.",
      },
      { status: 500 }
    );
  }
}
