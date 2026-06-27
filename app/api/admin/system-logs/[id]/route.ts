import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getSystemLogDetail } from "@/lib/admin/system-logs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const log = await getSystemLogDetail(id);

    if (!log) {
      return NextResponse.json(
        { success: false, message: "Log kaydı bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { log } });
  } catch {
    return NextResponse.json(
      { success: false, message: "Log detayı yüklenemedi." },
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
