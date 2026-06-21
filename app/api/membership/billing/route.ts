import { NextResponse } from "next/server";
import {
  MembershipServiceError,
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof MembershipServiceError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("MEMBERSHIP_BILLING_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Üyelik bilgileri yüklenemedi." },
      { status: 500 }
    );
  }
}
