import { notFound, redirect } from "next/navigation";
import { ProductStockMovementForm } from "@/components/products/product-stock-movement-form";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getOrCreateDefaultWarehouse } from "@/lib/warehouse-service";

type Props = {
  params: Promise<{ id: string }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function ProductStockMovementPage({ params }: Props) {
  const { id } = await params;

  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const product = await db.product.findFirst({
    where: {
      id,
      companyId: payload.companyId,
    },
    include: {
      category: true,
    },
  });

  if (!product) notFound();

  await getOrCreateDefaultWarehouse(payload.companyId);

  const warehouses = await db.warehouse.findMany({
    where: { companyId: payload.companyId, status: "ACTIVE" },
    select: { id: true, name: true, code: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const warehouseStocks = await db.warehouseStock.findMany({
    where: { companyId: payload.companyId, productId: id },
    select: { warehouseId: true, quantity: true },
  });

  return (
    <ProductStockMovementForm
      warehouses={warehouses}
      warehouseStocks={warehouseStocks}
      product={{
        id: product.id,
        name: product.name,
        stock: product.stock,
        minStock: product.minStock,
        unitType: product.unitType,
        warehouseLocation: product.warehouseLocation,
        category: product.category ? { name: product.category.name } : null,
      }}
    />
  );
}
