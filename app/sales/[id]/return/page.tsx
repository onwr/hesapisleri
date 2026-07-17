import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SaleReturnForm } from "@/components/sales/sale-return-form";
import { getAppSession } from "@/lib/app-session";
import { getPosPaymentStatusLabel } from "@/lib/pos-checkout-utils";
import { canAccessModule } from "@/lib/permission-utils";
import { canReturnSales } from "@/lib/sale-permission-utils";
import { getSaleReturnableSummary } from "@/lib/sale-return-service";
import { formatDateTimeDisplay } from "@/lib/format-utils";
import { isReturnableSaleStatus } from "@/lib/sale-query-utils";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SaleReturnPage({ params }: Props) {
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

  if (
    !canReturnSales(session.effectiveRole, session.companyUser.isOwner)
  ) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const summary = await getSaleReturnableSummary({
    companyId: session.company.id,
    saleId: id,
  });

  if (!summary) notFound();

  if (!isReturnableSaleStatus(summary.sale.status)) {
    redirect(`/sales/${id}`);
  }

  const hasReturnable = summary.items.some((item) => item.returnableQuantity > 0);
  if (!hasReturnable) {
    redirect(`/sales/${id}`);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5 px-3 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              İade / Değişim
            </p>
            <h1 className="text-2xl font-black text-[#0f1f4d]">
              {summary.sale.saleNo}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateTimeDisplay(
                summary.sale.saleDate ?? summary.sale.createdAt
              )}
            </p>
          </div>
          <Link
            href={`/sales/${id}`}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-[#0f1f4d]"
          >
            <ArrowLeft size={16} />
            Satışa Dön
          </Link>
        </div>

        <SaleReturnForm
          saleId={summary.sale.id}
          saleNo={summary.sale.saleNo}
          customerName={summary.sale.customer?.name ?? null}
          paymentStatusLabel={getPosPaymentStatusLabel(
            summary.sale.paymentStatus as "PAID" | "UNPAID" | "PARTIAL"
          )}
          items={summary.items}
        />
      </div>
    </AppShell>
  );
}
