import { notFound, redirect } from "next/navigation";
import { SaleReceiptActions } from "@/components/sales/sale-receipt-actions";
import { SaleReceiptView } from "@/components/sales/sale-receipt-view";
import { getAppSession } from "@/lib/app-session";
import { canAccessModule } from "@/lib/permission-utils";
import {
  getSaleReceiptData,
  SaleReceiptNotFoundError,
} from "@/lib/sale-receipt-data";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ width?: string }>;
};

export default async function SaleReceiptPage({ params, searchParams }: Props) {
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

  const { id } = await params;
  const query = await searchParams;
  const widthMm = query.width === "58" ? 58 : 80;

  let receipt;
  try {
    receipt = await getSaleReceiptData({
      companyId: session.company.id,
      saleId: id,
      widthMm,
    });
  } catch (error) {
    if (error instanceof SaleReceiptNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-none print:space-y-0">
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-extrabold text-[#0f1f4d]">Satış Fişi</h1>
          <p className="mt-1 text-sm text-slate-500">
            {receipt.saleNo} · Termal yazıcı uyumlu ({receipt.widthMm}mm)
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold">
            <a
              href="?width=80"
              className={
                receipt.widthMm === 80
                  ? "rounded-full bg-[#0f1f4d] px-3 py-1 text-white"
                  : "rounded-full border border-slate-200 px-3 py-1 text-slate-600"
              }
            >
              80mm
            </a>
            <a
              href="?width=58"
              className={
                receipt.widthMm === 58
                  ? "rounded-full bg-[#0f1f4d] px-3 py-1 text-white"
                  : "rounded-full border border-slate-200 px-3 py-1 text-slate-600"
              }
            >
              58mm
            </a>
          </div>
          <div className="mt-4">
            <SaleReceiptActions saleId={id} />
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <SaleReceiptView receipt={receipt} />
        </div>
      </div>
    </main>
  );
}
