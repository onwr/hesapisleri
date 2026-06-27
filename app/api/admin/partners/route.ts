import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerServiceError,
  createPartner,
  listPartners,
  parsePartnerListFilters,
} from "@/lib/admin/partners";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const data = await listPartners(parsePartnerListFilters(params));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Partner listesi yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const partner = await createPartner(auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Partner oluşturuldu.",
      data: partner,
    });
  } catch (error) {
    if (error instanceof AdminPartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Partner oluşturulamadı." },
      { status: 500 }
    );
  }
}
