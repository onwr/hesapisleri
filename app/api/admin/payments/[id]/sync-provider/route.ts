import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { syncPaymentProviderSchema } from "@/lib/admin/payments/admin-payment-schemas";
import { adminSyncPaymentWithProvider } from "@/lib/admin/payments/admin-payment-provider-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = syncPaymentProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Geçersiz istek" }, { status: 400 });
    }

    const result = await adminSyncPaymentWithProvider({
      paymentId: id,
      actorUserId: auth.user.id,
      force: parsed.data.force,
    });

    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : result.code === "NOT_SUPPORTED" ? 422 : 500;
      return NextResponse.json({ success: false, code: result.code, message: result.message }, { status });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[POST /api/admin/payments/[id]/sync-provider]", err);
    return NextResponse.json({ success: false, message: "Sync başarısız" }, { status: 500 });
  }
}
