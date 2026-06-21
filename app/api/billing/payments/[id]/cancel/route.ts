import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { MembershipServiceError } from "@/lib/membership-service";
import { cancelMembershipPayment } from "@/lib/payments/payment-service";

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

    const { id } = await params;
    await cancelMembershipPayment({
      companyId: session.company.id,
      paymentId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Ödeme iptal edildi. Yeni bir paket seçebilirsiniz.",
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
        message: error instanceof Error ? error.message : "Ödeme iptal edilemedi.",
      },
      { status: 500 }
    );
  }
}
