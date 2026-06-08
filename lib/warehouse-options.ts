import { db } from "@/lib/prisma";
import { getOrCreateDefaultWarehouse } from "@/lib/warehouse-service";

export type WarehouseOption = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
};

export async function getWarehouseOptions(companyId: string) {
  await getOrCreateDefaultWarehouse(companyId);

  const warehouses = await db.warehouse.findMany({
    where: { companyId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses[0] ?? null;

  return {
    warehouses,
    defaultWarehouseId: defaultWarehouse?.id ?? null,
  };
}

export async function getWarehouseStockByProductIds(
  companyId: string,
  warehouseId: string,
  productIds: string[]
) {
  if (productIds.length === 0) {
    return {} as Record<string, number>;
  }

  const stocks = await db.warehouseStock.findMany({
    where: {
      companyId,
      warehouseId,
      productId: { in: productIds },
    },
    select: {
      productId: true,
      quantity: true,
    },
  });

  return Object.fromEntries(
    stocks.map((entry) => [entry.productId, entry.quantity])
  );
}
