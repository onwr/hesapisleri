import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { previewPlanChangeSchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import { adminPreviewPlanChange } from "@/lib/admin/subscriptions/admin-subscription-action-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId } = await params;
    void subscriptionId; // alias
    const body = await req.json();
    const parsed = previewPlanChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await adminPreviewPlanChange({
      subscriptionId,
      actorUserId: auth.user.id,
      ...parsed.data,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    console.error("[POST plan-change/preview]", err);
    if (e?.code === "PREVIEW_SECRET_NOT_CONFIGURED") {
      return NextResponse.json(
        { success: false, message: e.message, code: e.code },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, message: e?.message ?? "Sunucu hatası" },
      { status: e?.status ?? 500 }
    );
  }
}
