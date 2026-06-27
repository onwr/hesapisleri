import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminJobServiceError,
  assertNoForbiddenJobRunKeys,
  runAdminJobManual,
} from "@/lib/admin/jobs";

type RouteContext = { params: Promise<{ jobKey: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { jobKey } = await context.params;
    const body = await req.json();
    assertNoForbiddenJobRunKeys(body);

    const run = await runAdminJobManual(jobKey, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Job çalıştırıldı.",
      data: { run },
    });
  } catch (error) {
    if (error instanceof AdminJobServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Job çalıştırılamadı." },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ success: false, message: "Method not allowed." }, { status: 405 });
}
