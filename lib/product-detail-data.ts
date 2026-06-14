import { startOfMonth, endOfMonth } from "@/lib/dashboard-metrics";
import { db } from "@/lib/prisma";
import { DEFAULT_CATEGORY_NAME } from "@/lib/product-form-utils";
import { formatProductMoney, isServiceProduct } from "@/lib/products-page-utils";

export async function getProductDetailData(companyId: string, productId: string) {
  const product = await db.product.findFirst({
    where: {
      id: productId,
      companyId,
    },
    include: {
      category: true,
    },
  });

  if (!product) {
    return null;
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [stockMovements, warehouseStocks, saleItems, channelMappings, monthSaleItems] =
    await Promise.all([
    db.stockMovement.findMany({
      where: {
        companyId,
        productId,
      },
      include: {
        warehouse: { select: { name: true } },
      },
      orderBy: { movementDate: "desc" },
      take: 10,
    }),
    db.warehouseStock.findMany({
      where: { companyId, productId },
      include: {
        warehouse: { select: { id: true, name: true, isDefault: true } },
      },
      orderBy: [{ warehouse: { isDefault: "desc" } }, { quantity: "desc" }],
    }),
    db.saleItem.findMany({
      where: {
        productId,
        sale: {
          companyId,
          status: { not: "CANCELLED" },
        },
      },
      include: {
        sale: {
          select: {
            id: true,
            saleNo: true,
            createdAt: true,
            status: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.productChannelMapping.findMany({
      where: { companyId, productId },
      orderBy: { channel: "asc" },
    }),
    db.saleItem.findMany({
      where: {
        productId,
        createdAt: { gte: monthStart, lte: monthEnd },
        sale: {
          companyId,
          status: { not: "CANCELLED" },
        },
      },
      select: {
        quantity: true,
        total: true,
      },
    }),
  ]);

  const buyPrice = Number(product.buyPrice);
  const sellPrice = Number(product.sellPrice);
  const profit = sellPrice - buyPrice;
  const margin = buyPrice > 0 ? (profit / buyPrice) * 100 : sellPrice > 0 ? 100 : 0;
  const isCriticalStock = product.stock <= product.minStock;
  const categoryName = product.category?.name ?? DEFAULT_CATEGORY_NAME;
  const monthSalesQuantity = monthSaleItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const monthSalesTotal = monthSaleItems.reduce(
    (sum, item) => sum + Number(item.total),
    0
  );

  return {
    product: {
      ...product,
      categoryName,
      buyPrice,
      sellPrice,
      profit,
      margin,
      stockValue: product.stock * sellPrice,
      isService: isServiceProduct({
        name: product.name,
        description: product.description,
        categoryName,
      }),
    },
    stockMovements,
    warehouseStocks: warehouseStocks.map((entry) => ({
      warehouseId: entry.warehouse.id,
      warehouseName: entry.warehouse.name,
      quantity: entry.quantity,
      isDefault: entry.warehouse.isDefault,
    })),
    warehouseCount: warehouseStocks.filter((entry) => entry.quantity > 0).length,
    recentSales: saleItems.map((item) => ({
      id: item.sale.id,
      saleNo: item.sale.saleNo,
      createdAt: item.sale.createdAt,
      status: item.sale.status,
      quantity: item.quantity,
      total: Number(item.total),
      saleTotal: Number(item.sale.total),
    })),
    isCriticalStock,
    monthSalesQuantity,
    monthSalesTotal,
    channelMappings: channelMappings.map((mapping) => ({
      id: mapping.id,
      channel: mapping.channel,
      merchantSku: mapping.merchantSku,
      barcode: mapping.barcode,
      externalProductId: mapping.externalProductId,
    })),
    formatted: {
      buyPrice: formatProductMoney(buyPrice),
      sellPrice: formatProductMoney(sellPrice),
      profit: formatProductMoney(profit),
      stockValue: formatProductMoney(product.stock * sellPrice),
      monthSalesTotal: formatProductMoney(monthSalesTotal),
    },
  };
}
