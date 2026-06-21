import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  MembershipServiceError,
  updateMembershipPaymentAdmin,
  updateMembershipPaymentAdminSchema,
} from "@/lib/membership-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = updateMembershipPaymentAdminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Güncelleme bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    const payment = await updateMembershipPaymentAdmin({
      paymentId: id,
      actorUserId: auth.user.id,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    return NextResponse.json({
      success: true,
      message:
        parsed.data.status === "PAID"
          ? "Ödeme onaylandı ve üyelik uzatıldı."
          : "Ödeme durumu güncellendi.",
      data: { payment },
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_MEMBERSHIP_PAYMENT_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ödeme güncellenemedi." },
      { status: 500 }
    );
  }
}
