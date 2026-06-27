import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { extendTrialAdminSchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import { adminExtendTrial } from "@/lib/admin/subscriptions/admin-subscription-action-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: subscriptionId } = await params;
    const body = await req.json();
    const parsed = extendTrialAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await adminExtendTrial({
      subscriptionId,
      actorUserId: auth.user.id,
      ...parsed.data,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    console.error("[POST /api/admin/subscriptions/[id]/trial-extend]", err);
    return NextResponse.json(
      { success: false, message: e?.message ?? "Sunucu hatası" },
      { status: e?.status ?? 500 }
    );
  }
}
