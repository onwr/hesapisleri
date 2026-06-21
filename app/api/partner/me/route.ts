import { NextResponse } from "next/server";
import { requirePartnerApi } from "@/lib/partner-auth";
import {
  PartnerServiceError,
  getPartnerProfile,
  updatePartnerProfileSelf,
} from "@/lib/partner-service";

export async function GET() {
  try {
    const auth = await requirePartnerApi();
    if ("error" in auth) return auth.error;

    const partner = await getPartnerProfile(auth.partner.id);

    return NextResponse.json({ success: true, data: { partner } });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PARTNER_ME_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Partner verileri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requirePartnerApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const partner = await updatePartnerProfileSelf(auth.partner.id, {
      phone: body.phone,
      iban: body.iban,
      bankName: body.bankName,
      accountHolderName: body.accountHolderName,
      taxNumber: body.taxNumber,
    });

    return NextResponse.json({
      success: true,
      message: "Profil güncellendi.",
      data: { partner },
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PARTNER_ME_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Profil güncellenemedi." },
      { status: 500 }
    );
  }
}
