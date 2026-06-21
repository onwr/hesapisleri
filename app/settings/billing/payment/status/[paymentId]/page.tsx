import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PaymentStatusActions } from "@/components/settings/payment-status-actions";
import { getAppSession } from "@/lib/app-session";
import { db } from "@/lib/prisma";
import { getMembershipPaymentStatusLabel } from "@/lib/membership-utils";
import { formatMoney } from "@/lib/format-utils";

type PageProps = { params: Promise<{ paymentId: string }> };

export default async function BillingPaymentStatusPage({ params }: PageProps) {
  const session = await getAppSession();
  const { paymentId } = await params;
  const payment = await db.membershipPayment.findFirst({
    where: { id: paymentId, companyId: session.company.id },
  });

  if (!payment) notFound();

  const waiting =
    payment.status === "CREATED" ||
    payment.status === "FORM_READY" ||
    payment.status === "PENDING" ||
    payment.status === "WAIT_CALLBACK" ||
    payment.status === "UNKNOWN";

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Ödeme Durumu
        </p>
        <h1 className="mt-2 text-xl font-black text-[#0f1f4d]">
          {getMembershipPaymentStatusLabel(payment.status)}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {waiting
            ? "PayTR bildirimi veya mutabakat sonucu bekleniyor."
            : "Ödeme kaydının son durumu aşağıdadır."}
        </p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">Ödeme No</p>
            <p className="mt-1 font-black text-[#0f1f4d]">{payment.merchantOid ?? payment.paymentRef}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-bold text-slate-400">Tutar</p>
            <p className="mt-1 font-black text-[#0f1f4d]">
              {formatMoney(payment.amount.toString())}
            </p>
          </div>
        </div>
        <PaymentStatusActions
          paymentId={payment.id}
          initialStatus={payment.status}
          autoSync
        />
      </section>
    </AppShell>
  );
}
