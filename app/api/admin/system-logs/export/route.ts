import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { exportSystemLogsCsv, parseSystemLogListFilters } from "@/lib/admin/system-logs";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const filters = parseSystemLogListFilters(Object.fromEntries(url.searchParams.entries()));
    const csv = await exportSystemLogsCsv(filters);

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="system-logs-${stamp}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "CSV dışa aktarılamadı." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
