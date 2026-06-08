import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminCompanies } from "@/lib/admin-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);

    const data = await getAdminCompanies({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      membershipStatus: searchParams.get("membershipStatus") ?? undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_COMPANIES_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firmalar yüklenemedi." },
      { status: 500 }
    );
  }
}
