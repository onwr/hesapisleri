import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminCompanyActionError,
  sendOwnerPasswordReset,
} from "@/lib/admin/companies/admin-company-action-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const data = await sendOwnerPasswordReset(id, auth.user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminCompanyActionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Parola sıfırlama bağlantısı oluşturulamadı." },
      { status: 500 }
    );
  }
}
