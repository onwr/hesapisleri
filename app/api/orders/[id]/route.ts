import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { updateOrderById, updateOrderSchema } from "@/lib/order-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz sipariş bilgileri.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await updateOrderById({
      saleId: id,
      companyId: auth.companyId,
      userId: auth.userId,
      data: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    const reason = parsed.data.orderStatus === "CANCELLED" ? "order-cancel" : "order-status-update";
    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason,
        entity: { id, ...(result.data as Record<string, unknown>) },
        message: "Sipariş güncellendi.",
        entityIds: { orderId: id },
      }),
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Sipariş güncellenemedi." },
      { status: 500 }
    );
  }
}
