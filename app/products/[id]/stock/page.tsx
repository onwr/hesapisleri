import { notFound } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { ProductStockMovementForm } from "@/components/products/product-stock-movement-form";
import { db } from "@/lib/prisma";
import { getOrCreateDefaultWarehouse } from "@/lib/warehouse-service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductStockMovementPage({ params }: Props) {
  const session = await guardPageModule("products");
  const company = session.company;
  const { id } = await params;

  const product = await db.product.findFirst({
    where: {
      id,
      companyId: company.id,
    },
    include: {
      category: true,
    },
  });

  if (!product) notFound();

  await getOrCreateDefaultWarehouse(company.id);

  const warehouses = await db.warehouse.findMany({
    where: { companyId: company.id, status: "ACTIVE" },
    select: { id: true, name: true, code: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const warehouseStocks = await db.warehouseStock.findMany({
    where: { companyId: company.id, productId: id },
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
