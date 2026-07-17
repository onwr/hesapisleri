import { notFound, redirect } from "next/navigation";
import { SaleReturnReceiptActions } from "@/components/sales/sale-return-receipt-actions";
import {
  buildSaleReturnReceiptViewModel,
  SaleReturnReceiptView,
} from "@/components/sales/sale-return-receipt-view";
import { getAppSession } from "@/lib/app-session";
import { canAccessModule } from "@/lib/permission-utils";
import { db } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string; returnId: string }>;
  searchParams: Promise<{ width?: string }>;
};

export default async function SaleReturnReceiptPage({
  params,
  searchParams,
}: Props) {
  const session = await getAppSession();
  const canView =
    canAccessModule(
      session.effectiveRole,
      "sales",
      session.companyUser.isOwner
    ) ||
    canAccessModule(session.effectiveRole, "pos", session.companyUser.isOwner);

  if (!canView) {
    redirect("/unauthorized");
  }

  const { id, returnId } = await params;
  const query = await searchParams;
  const widthMm = query.width === "58" ? 58 : 80;

  const [saleReturn, company] = await Promise.all([
    db.saleReturn.findFirst({
      where: {
        id: returnId,
        saleId: id,
        companyId: session.company.id,
      },
      include: {
        sale: { select: { saleNo: true } },
        customer: { select: { name: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.company.findFirst({
      where: { id: session.company.id },
      select: {
        name: true,
        phone: true,
        address: true,
        taxNo: true,
        taxOffice: true,
      },
    }),
  ]);

  if (!saleReturn || !company) {
    notFound();
  }

  const receipt = buildSaleReturnReceiptViewModel({
    widthMm,
    company,
    saleNo: saleReturn.sale.saleNo,
    returnNo: saleReturn.returnNo,
    createdAt: saleReturn.createdAt,
    customerName: saleReturn.customer?.name ?? null,
    reason: saleReturn.reason,
    note: saleReturn.note,
    refundMethod: saleReturn.refundMethod,
    totalReturnAmount: Number(saleReturn.totalReturnAmount),
    items: saleReturn.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalAmount: Number(item.totalAmount),
    })),
  });

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-none print:space-y-0">
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-extrabold text-[#0f1f4d]">İade Fişi</h1>
          <p className="mt-1 text-sm text-slate-500">
            {receipt.returnNo} · {receipt.saleNo}
          </p>
          <div className="mt-4">
            <SaleReturnReceiptActions saleId={id} />
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <SaleReturnReceiptView receipt={receipt} />
        </div>
      </div>
    </main>
  );
}
