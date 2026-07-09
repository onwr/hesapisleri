import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { archiveOrder } from "@/lib/order-archive-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };

    const result = await archiveOrder({
      companyId: auth.companyId,
      orderId: id,
      userId: auth.userId,
      reason: body.reason,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "order-archive",
        entity: result.data,
        message: result.message ?? "Sipariş arşivlendi.",
        entityIds: { orderId: id },
      })
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Sipariş arşivlenemedi." },
      { status: 500 }
    );
  }
}
