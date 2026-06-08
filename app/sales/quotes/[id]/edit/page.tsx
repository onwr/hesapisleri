import { notFound, redirect } from "next/navigation";
import { EditQuoteForm } from "./edit-quote-form";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function EditQuotePage({ params }: Props) {
  const { id } = await params;

  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const sale = await db.sale.findFirst({
    where: {
      id,
      companyId: payload.companyId,
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!sale) notFound();

  if (sale.status !== "DRAFT") {
    redirect(`/sales/${sale.id}`);
  }

  return (
    <EditQuoteForm
      quoteId={sale.id}
      saleNo={sale.saleNo}
      initialCustomerId={sale.customerId ?? ""}
      initialNote={sale.note ?? ""}
      initialItems={sale.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        vatRate: item.vatRate,
        stock: item.product?.stock ?? 0,
      }))}
    />
  );
}
