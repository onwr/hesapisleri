import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { requireApiModuleAccess } from "@/lib/module-access";
import { cancelWarehouseTransfer } from "@/lib/warehouse-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = { params: Promise<{ id: string }> };

const cancelSchema = z.object({
  reason: z.string().trim().optional(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);

    const result = await cancelWarehouseTransfer(
      auth.companyId,
      auth.userId,
      id,
      parsed.success ? parsed.data.reason : undefined
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    invalidateDashboardCache(auth.companyId, "warehouse-transfer-cancel");

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "warehouse-transfer-cancel",
        entity: result.data,
        message: "Transfer iptal edildi.",
      })
    );
  } catch (error) {
    console.error("STOCKS_TRANSFER_CANCEL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transfer iptal edilemedi." },
      { status: 500 }
    );
  }
}
