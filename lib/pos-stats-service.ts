import { db } from "@/lib/prisma";
import { startOfZonedDay } from "@/lib/finance/financial-period";
import type { UserRole } from "@prisma/client";

export type PosQuickProductStat = {
  productId: string;
  name: string;
  sellPrice: number;
  stock: number;
  productType: "STOCK" | "SERVICE";
  soldQty: number;
};

export type PosTodayStats = {
  todaySalesCount: number;
  todaySalesTotal: number;
  todayCashTotal: number;
  todayCardTotal: number;
  cashBalanceTotal: number;
  topProducts: PosQuickProductStat[];
};

export async function getPosTodayStats(input: {
  companyId: string;
  userId: string;
  effectiveRole: UserRole | "OWNER" | "ADMIN" | "ACCOUNTANT" | "STAFF" | "POS_STAFF";
  at?: Date;
}): Promise<PosTodayStats> {
  const todayStart = startOfZonedDay(input.at ?? new Date());
  const staffScoped = input.effectiveRole === "POS_STAFF";

  const salesWhere = {
    companyId: input.companyId,
    sourceChannel: "POS" as const,
    status: "COMPLETED" as const,
    createdAt: { gte: todayStart },
    ...(staffScoped ? { userId: input.userId } : {}),
  };

  const [salesAgg, cashAgg, paymentGroups, topRows] = await Promise.all([
    db.sale.aggregate({
      where: salesWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.account.aggregate({
      where: { companyId: input.companyId, type: "CASH", status: "ACTIVE" },
      _sum: { balance: true },
    }),
    db.salePayment.groupBy({
      by: ["paymentMethod"],
      where: {
        sale: salesWhere,
      },
      _sum: { amount: true },
    }),
    db.saleItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        sale: salesWhere,
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 12,
    }),
  ]);

  let todayCashTotal = 0;
  let todayCardTotal = 0;
  for (const row of paymentGroups) {
    const amount = Number(row._sum.amount ?? 0);
    if (row.paymentMethod === "CASH") todayCashTotal = amount;
    if (row.paymentMethod === "CARD") todayCardTotal = amount;
  }

  const productIds = topRows
    .map((row) => row.productId)
    .filter((id): id is string => Boolean(id));

  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: {
            companyId: input.companyId,
            id: { in: productIds },
            status: "ACTIVE",
          },
          select: {
            id: true,
            name: true,
            sellPrice: true,
            stock: true,
            productType: true,
          },
        })
      : [];

  const productById = new Map(products.map((product) => [product.id, product]));
  const soldById = new Map(
    topRows.map((row) => [row.productId!, Number(row._sum.quantity ?? 0)])
  );

  const topProducts: PosQuickProductStat[] = productIds
    .map((id) => {
      const product = productById.get(id);
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        sellPrice: Number(product.sellPrice),
        stock: product.stock,
        productType: product.productType === "SERVICE" ? "SERVICE" : "STOCK",
        soldQty: soldById.get(id) ?? 0,
      } satisfies PosQuickProductStat;
    })
    .filter((item): item is PosQuickProductStat => item !== null);

  return {
    todaySalesCount: salesAgg._count._all,
    todaySalesTotal: Number(salesAgg._sum.total ?? 0),
    todayCashTotal,
    todayCardTotal,
    cashBalanceTotal: Number(cashAgg._sum.balance ?? 0),
    topProducts,
  };
}
