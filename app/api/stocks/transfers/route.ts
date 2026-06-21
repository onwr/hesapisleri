import { NextResponse } from "next/server";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { moveStockBetweenWarehouses } from "@/lib/warehouse-service";
import {
  normalizeWarehouseTransferItems,
  warehouseTransferSchema,
  TRANSFER_FAILED_MESSAGE,
} from "@/lib/warehouse-transfer-utils";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    const transfers = await db.warehouseTransfer.findMany({
      where: {
        companyId: auth.companyId,
        ...(productId ? { productId } : {}),
      },
      include: {
        product: { select: { id: true, name: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        items: { select: { id: true, productId: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error) {
    console.error("STOCKS_TRANSFERS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transferler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = warehouseTransferSchema.safeParse(body);

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

    const fromWarehouseId =
      parsed.data.sourceWarehouseId ?? parsed.data.fromWarehouseId;
    const toWarehouseId =
      parsed.data.destinationWarehouseId ?? parsed.data.toWarehouseId;

    if (!fromWarehouseId || !toWarehouseId) {
      return NextResponse.json(
        { success: false, message: "Kaynak ve hedef depo seçilmelidir." },
        { status: 400 }
      );
    }

    const normalizedItems = normalizeWarehouseTransferItems(parsed.data);
    if (!normalizedItems.ok) {
      return NextResponse.json(
        { success: false, message: normalizedItems.message },
        { status: 400 }
      );
    }

    const result = await moveStockBetweenWarehouses({
      companyId: auth.companyId,
      userId: auth.userId,
      fromWarehouseId,
      toWarehouseId,
      productId: normalizedItems.items[0]!.productId,
      quantity: normalizedItems.items[0]!.quantity,
      items: normalizedItems.items,
      note: parsed.data.note,
      transferDate: parsed.data.transferDate,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    if (!result.replayed) {
      invalidateDashboardCache(auth.companyId, "warehouse-transfer");
    }

    return NextResponse.json({
      success: true,
      message: result.replayed
        ? "Depo transferi daha önce tamamlanmıştı."
        : "Depo transferi başarıyla tamamlandı.",
      transfer: result.data.transfer,
      replayed: result.replayed ?? false,
    });
  } catch (error) {
    console.error("STOCKS_TRANSFERS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: TRANSFER_FAILED_MESSAGE },
      { status: 500 }
    );
  }
}
