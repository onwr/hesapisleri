import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminServiceError,
  getAdminCompanyDetail,
  updateAdminCompany,
} from "@/lib/admin-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminCompanyDetail(id);

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Firma bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_COMPANY_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firma detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await updateAdminCompany(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Firma güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_COMPANY_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firma güncellenemedi." },
      { status: 500 }
    );
  }
}
