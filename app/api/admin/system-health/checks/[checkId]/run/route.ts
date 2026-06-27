import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminSystemHealthServiceError,
  assertNoArbitraryHealthRunInput,
  assertValidHealthCheckId,
  runSingleSystemHealthCheck,
} from "@/lib/admin/system-health";

type RouteContext = { params: Promise<{ checkId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { checkId } = await context.params;
    assertValidHealthCheckId(checkId);

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    assertNoArbitraryHealthRunInput(body);

    const check = await runSingleSystemHealthCheck(checkId, auth.user.id);

    return NextResponse.json({
      success: true,
      message: "Kontrol tamamlandı.",
      data: { check },
    });
  } catch (error) {
    if (error instanceof AdminSystemHealthServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    if (error instanceof Error) {
      const status = error.message.includes("cooldown") ? 429 : 400;
      return NextResponse.json({ success: false, message: error.message }, { status });
    }
    return NextResponse.json(
      { success: false, message: "Kontrol çalıştırılamadı." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
