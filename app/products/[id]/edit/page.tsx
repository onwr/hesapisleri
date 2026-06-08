import { notFound, redirect } from "next/navigation";
import { EditProductForm } from "@/components/products/edit-product-form";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function EditProductPage({ params }: Props) {
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

  return (
    <EditProductForm
      companyId={payload.companyId}
      product={{
        id: product.id,
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
