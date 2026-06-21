import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PartnerServiceError,
  approvePartnerApplication,
  rejectPartnerApplication,
} from "@/lib/partner-service";
import {
  approvePartnerApplicationSchema,
  rejectPartnerApplicationSchema,
} from "@/lib/partner-utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id } = await context.params;

    if (body.status === "REJECTED") {
      const parsed = rejectPartnerApplicationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: "Red nedeni zorunludur." },
          { status: 400 }
        );
      }

      await rejectPartnerApplication({
        applicationId: id,
        actorUserId: auth.user.id,
        rejectionReason: parsed.data.rejectionReason,
      });

      return NextResponse.json({
        success: true,
        message: "Başvuru reddedildi.",
      });
    }

    const parsed = approvePartnerApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Onay bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const partner = await approvePartnerApplication({
      applicationId: id,
      actorUserId: auth.user.id,
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: "Partner başvurusu onaylandı.",
      data: { partner },
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_PARTNER_APPLICATION_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Başvuru güncellenemedi." },
      { status: 500 }
    );
  }
}
