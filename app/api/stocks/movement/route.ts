import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { applyProductStockMovement } from "@/lib/stock-movement-service";
import {
  getFirstStockMovementErrorMessage,
  stockMovementRequestSchema,
} from "@/lib/stock-movement-utils";
import { invalidateTenantCaches } from "@/lib/tenant-cache/tenant-cache-invalidation";
import { z } from "zod";

const stockCenterMovementSchema = stockMovementRequestSchema.extend({
  productId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = stockCenterMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, ...input } = parsed.data;

    const result = await applyProductStockMovement({
      companyId: auth.companyId,
      userId: auth.userId,
      productId,
      input,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errors: result.errors,
        },
        { status: result.status }
      );
    }

    invalidateTenantCaches(auth.companyId, {
      reason: "stock-movement",
      entityIds: {
        productId,
        warehouseId: parsed.data.warehouseId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stok hareketi kaydedildi.",
      data: {
        ...result.data,
        affectedIds: [productId],
        newStock: result.data?.newStock,
        status: "recorded",
      },
    });
  } catch (error) {
    console.error("STOCKS_MOVEMENT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: getFirstStockMovementErrorMessage(
          "Stok hareketi kaydedilirken bir hata oluştu."
        ),
      },
      { status: 500 }
    );
  }
}
