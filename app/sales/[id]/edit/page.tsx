import { notFound, redirect } from "next/navigation";
import { guardPageModule } from "@/lib/module-access";
import { canUpdateSales } from "@/lib/sale-permission-utils";
import { validateSaleEditEligibility } from "@/lib/sale-mutation-policy";
import { EditSaleForm } from "./edit-sale-form";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function EditSalePage({ params }: Props) {
  const session = await guardPageModule("sales");
  const company = session.company;
  const { id } = await params;

  if (
    !canUpdateSales(session.effectiveRole, session.companyUser.isOwner)
  ) {
    redirect("/unauthorized");
  }

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
      invoice: {
        include: {
          documentSubmission: true,
        },
      },
    },
  });

  if (!sale) notFound();

  const eligibility = validateSaleEditEligibility(sale);
  if (!eligibility.ok) {
    redirect(`/sales/${sale.id}`);
  }

  return (
    <EditSaleForm
      saleId={sale.id}
      saleNo={sale.saleNo}
      revisionNumber={sale.revisionNumber}
      initialCustomerId={sale.customerId ?? ""}
      initialNote={sale.note ?? ""}
      initialSaleDate={formatDateInputValue(sale.saleDate ?? sale.createdAt)}
      initialWarehouseId={sale.warehouseId ?? ""}
      initialPaymentStatus={sale.paymentStatus as "PAID" | "PARTIAL" | "UNPAID"}
      initialPaidAmount={Number(sale.paidAmount)}
      initialDiscountValue={Number(sale.discount)}
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
