import { NextResponse } from "next/server";
import {
  MembershipServiceError,
  createMembershipPayment,
  createMembershipPaymentSchema,
  getMembershipBillingData,
} from "@/lib/membership-service";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { SettingsAccessError } from "@/lib/settings-service";

export async function GET() {
  try {
    const session = await getAppSession();

    if (
      !canManageMembership(
        session.effectiveRole,
        session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu sayfaya erişim yetkiniz yok." },
        { status: 403 }
      );
    }

    const data = await getMembershipBillingData({
      companyId: session.company.id,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { payments: data.payments },
    });
  } catch (error) {
    if (error instanceof MembershipServiceError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("MEMBERSHIP_PAYMENTS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ödeme geçmişi yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const parsed = createMembershipPaymentSchema.safeParse(body);

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

    const result = await createMembershipPayment({
      companyId: session.company.id,
      userId: session.user.id,
      planId: parsed.data.planId,
      period: parsed.data.period,
      paymentMethod: parsed.data.paymentMethod,
    });

    return NextResponse.json({
      success: true,
      message: "Ödeme talebi oluşturuldu.",
      data: result,
    });
  } catch (error) {
    if (error instanceof MembershipServiceError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("MEMBERSHIP_PAYMENTS_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ödeme talebi oluşturulamadı." },
      { status: 500 }
    );
  }
}
