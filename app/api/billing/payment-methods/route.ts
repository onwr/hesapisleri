import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { listCompanyPaymentMethods } from "@/lib/payments/payment-method-service";

export async function GET() {
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

    return NextResponse.json({
      success: true,
      data: await listCompanyPaymentMethods(session.company.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ödeme yöntemleri yüklenemedi.",
      },
      { status: 500 }
    );
  }
}
