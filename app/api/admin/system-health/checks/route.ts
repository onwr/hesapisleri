import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listSystemHealthChecks } from "@/lib/admin/system-health";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    const data = await listSystemHealthChecks({ refresh });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "Sağlık kontrolleri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
