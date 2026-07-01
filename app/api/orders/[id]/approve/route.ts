import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  applySaleStockDecrement,
  SaleStockValidationError,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const sale = await db.sale.findFirst({
      where: { id, companyId: auth.companyId },
      include: { items: true, warehouse: true },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Sipariş bulunamadı." },
        { status: 404 }
      );
    }

    if (sale.orderStatus !== "WAITING") {
      return NextResponse.json(
        {
          success: false,
          message: "Sadece bekleyen siparişler onaylanabilir.",
        },
        { status: 400 }
      );
    }

    const stockItems = sale.items.map((item) => ({
      productId: item.productId ?? undefined,
      quantity: item.quantity,
      name: item.name,
      warehouseId: item.warehouseId ?? undefined,
    }));

    const companySettings = await db.companySettings.findUnique({
      where: { companyId: auth.companyId },
      select: { allowNegativeStockSales: true },
    });
    const allowNegativeStock = companySettings?.allowNegativeStockSales ?? false;

    let stockWarnings: Awaited<ReturnType<typeof validateSaleItemsStock>> = [];

    await db.$transaction(async (tx) => {
      stockWarnings = await validateSaleItemsStock(
        tx,
        auth.companyId,
        stockItems,
        sale.warehouseId,
        allowNegativeStock
      );

      await applySaleStockDecrement(
        tx,
        auth.companyId,
        sale.saleNo,
        sale.items,
        sale.warehouseId,
        allowNegativeStock
      );

      await tx.sale.update({
        where: { id: sale.id },
        data: { orderStatus: "APPROVED" },
      });

      await tx.activityLog.create({
        data: {
          companyId: auth.companyId,
          userId: auth.userId,
          action: "APPROVE",
          module: "orders",
          message: `${sale.saleNo} siparişi onaylandı ve stok düşümü yapıldı.`,
        },
      });
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "order-approve",
        entity: { id },
        message: "Sipariş onaylandı ve stok düşüldü.",
        entityIds: { orderId: id },
        extra:
          stockWarnings.length > 0
            ? {
                warning: stockWarnings[0]?.message,
                negativeStockItems: stockWarnings,
              }
            : {},
      }),
    );
  } catch (error) {
    if (error instanceof SaleStockValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Sipariş onaylanamadı.",
      },
      { status: 500 }
    );
  }
}
