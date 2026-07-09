import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { restoreOrder } from "@/lib/order-archive-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const result = await restoreOrder({
      companyId: auth.companyId,
      orderId: id,
      userId: auth.userId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "order-restore",
        entity: result.data,
        message: result.message ?? "Sipariş arşivden çıkarıldı.",
        entityIds: { orderId: id },
      })
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Sipariş arşivden çıkarılamadı." },
      { status: 500 }
    );
  }
}
