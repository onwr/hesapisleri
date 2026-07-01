import "server-only";

import { db } from "@/lib/prisma";

export async function getSaleDetailData(companyId: string, saleId: string) {
  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      companyId,
    },
    include: {
      customer: true,
      warehouse: {
        select: { id: true, name: true },
      },
      payments: {
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      items: {
        include: {
          product: true,
        },
      },
      invoice: {
        include: {
          documentSubmission: true,
        },
      },
      cancelledByUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!sale) return null;

  const [stockMovements, accountTransactions] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        companyId,
        note: {
          contains: sale.saleNo,
        },
      },
      include: {
        product: true,
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.accountTransaction.findMany({
      where: {
        title: {
          contains: sale.saleNo,
        },
        account: {
          companyId,
        },
      },
      include: {
        account: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return { sale, stockMovements, accountTransactions };
}
