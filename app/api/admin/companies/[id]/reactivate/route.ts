import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminCompanyActionError,
  reactivateAdminCompany,
} from "@/lib/admin/companies/admin-company-action-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = await reactivateAdminCompany(id, auth.user.id, body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminCompanyActionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Yeniden etkinleştirme başarısız." },
      { status: 500 }
    );
  }
}
