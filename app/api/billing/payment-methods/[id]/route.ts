import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { revokePaymentMethod } from "@/lib/payments/payment-method-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
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

    const { id } = await params;
    await revokePaymentMethod({
      companyId: session.company.id,
      paymentMethodId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Kart silinemedi.",
      },
      { status: 500 }
    );
  }
}
