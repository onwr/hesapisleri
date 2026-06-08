import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);

    const data = await getAdminUsers({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      role: searchParams.get("role") ?? undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_USERS_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcılar yüklenemedi." },
      { status: 500 }
    );
  }
}
