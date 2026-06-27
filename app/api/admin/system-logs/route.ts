import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getSystemLogMetrics,
  listDistinctSystemLogActions,
  listDistinctSystemLogModules,
  listSystemLogs,
  parseSystemLogListFilters,
} from "@/lib/admin/system-logs";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const filters = parseSystemLogListFilters(Object.fromEntries(url.searchParams.entries()));

    const [list, metrics, modules, actions] = await Promise.all([
      listSystemLogs(filters),
      getSystemLogMetrics(),
      listDistinctSystemLogModules(),
      listDistinctSystemLogActions(),
    ]);

    return NextResponse.json({
      success: true,
      data: { ...list, metrics, modules, actions, filters },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Sistem logları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
