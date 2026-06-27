import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  isAdminSearchQueryValid,
  searchAdminPlatform,
} from "@/lib/admin/admin-overview-search-service";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!isAdminSearchQueryValid(q)) {
    return NextResponse.json({
      success: true,
      data: {
        companies: [],
        users: [],
        subscriptions: [],
        payments: [],
        partners: [],
      },
    });
  }

  try {
    const data = await searchAdminPlatform(q);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_SEARCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Arama yapılamadı." },
      { status: 500 }
    );
  }
}
