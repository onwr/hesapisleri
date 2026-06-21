import { notFound } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { EditProductForm } from "@/components/products/edit-product-form";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: Props) {
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

  return (
    <EditProductForm
      companyId={company.id}
      product={{
        id: product.id,
        productType: product.productType,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.description,
        imageUrl: product.imageUrl,
        status: product.status,
        stock: product.stock,
        minStock: product.minStock,
        unitType: product.unitType,
        warehouseLocation: product.warehouseLocation,
        buyPrice: Number(product.buyPrice),
        sellPrice: Number(product.sellPrice),
        vatRate: product.vatRate,
        category: product.category ? { name: product.category.name } : null,
      }}
    />
  );
}
