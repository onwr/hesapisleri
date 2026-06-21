import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function applyWarehouseStockDelta(
  tx: TransactionClient,
  input: {
    companyId: string;
    warehouseId: string;
    productId: string;
    delta: number;
  }
) {
  if (input.delta === 0) {
    return;
  }

  if (input.delta < 0) {
    const amount = Math.abs(input.delta);

    await tx.warehouseStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
      create: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        quantity: -amount,
      },
      update: {
        quantity: { decrement: amount },
      },
    });

    return;
  }

  await tx.warehouseStock.upsert({
    where: {
      warehouseId_productId: {
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    },
    create: {
      companyId: input.companyId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: input.delta,
    },
    update: {
      quantity: { increment: input.delta },
    },
  });
}
