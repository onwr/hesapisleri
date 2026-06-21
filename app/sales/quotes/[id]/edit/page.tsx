import { notFound, redirect } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { EditQuoteForm } from "./edit-quote-form";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditQuotePage({ params }: Props) {
  const session = await guardPageModule("sales");
  const company = session.company;
  const { id } = await params;

  const sale = await db.sale.findFirst({
    where: {
      id,
      companyId: company.id,
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
