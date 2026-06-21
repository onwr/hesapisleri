import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { MembershipServiceError } from "@/lib/membership-service";
import { syncMembershipPaymentWithProvider } from "@/lib/payments/payment-service";

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
    const result = await syncMembershipPaymentWithProvider({
      companyId: session.company.id,
      paymentId: id,
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentId: result.payment?.id ?? id,
        status: result.status ?? result.payment?.status,
        synced: result.synced,
        providerStatus: result.providerStatus,
        message: result.message,
      },
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYMENT_SYNC_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Ödeme durumu doğrulanamadı.",
      },
      { status: 500 }
    );
  }
}
